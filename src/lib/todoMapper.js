import { sanitizeTodoText } from '../utils/text'
import { normalizeEstimateMinutes } from '../utils/estimate'
import { normalizePriority } from '../utils/todoMeta'

/** PostgreSQL integer: не допускаем Date.now() и прочие «таймстампы». */
const PG_INT_MAX = 2147483647
const PG_INT_MIN = -2147483648

export function clampSortOrder(value) {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n)) return 0
  return Math.min(PG_INT_MAX, Math.max(PG_INT_MIN, n))
}

/**
 * Строка из таблицы `todos` (snake_case) → объект для UI (camelCase).
 */
export function fromDbRow(row) {
  if (!row || typeof row !== 'object') return null

  const text = sanitizeTodoText(String(row.text ?? row.title ?? ''))
  if (!text) return null

  const subtasks = Array.isArray(row.subtasks)
    ? row.subtasks
        .map((sub) => {
          if (!sub || typeof sub !== 'object') return null
          const subText = sanitizeTodoText(String(sub.text ?? ''))
          if (!subText) return null
          return {
            id: String(sub.id ?? crypto.randomUUID()),
            text: subText,
            completed: Boolean(sub.completed),
          }
        })
        .filter(Boolean)
    : []

  const createdAt =
    typeof row.created_at === 'number'
      ? row.created_at
      : row.created_at
        ? Date.parse(row.created_at)
        : Date.now()

  const habitRaw = row.habit_id
  const habitId =
    habitRaw === null || habitRaw === undefined || habitRaw === ''
      ? null
      : String(habitRaw)

  return {
    id: String(row.id),
    text,
    completed: Boolean(row.completed),
    period: row.period || 'day',
    date: row.date || null,
    subtasks,
    priority: normalizePriority(row.priority),
    estimatedMinutes: normalizeEstimateMinutes(row.estimated_minutes),
    spentSeconds: Math.max(0, Math.floor(Number(row.spent_seconds) || 0)),
    habitId,
    order: clampSortOrder(row.sort_order),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  }
}

/**
 * Объект UI → поля для insert/update в Supabase.
 * Пишем и `text`, и `title` — на случай старой схемы с title.
 */
export function toDbPayload(todo, userId) {
  const text = sanitizeTodoText(String(todo.text ?? ''))
  const payload = {
    text,
    title: text,
    completed: Boolean(todo.completed),
    period: todo.period || 'day',
    date: todo.date || null,
    subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
    priority: normalizePriority(todo.priority),
    estimated_minutes: normalizeEstimateMinutes(todo.estimatedMinutes),
    spent_seconds: Math.max(0, Math.floor(Number(todo.spentSeconds) || 0)),
    habit_id:
      typeof todo.habitId === 'string' && todo.habitId.length > 0
        ? todo.habitId
        : null,
    sort_order: clampSortOrder(todo.order),
  }

  if (userId) {
    payload.user_id = userId
  }

  // Тот же uuid, что в UI — иначе complete до ответа insert бьёт в несуществующий id.
  if (todo.id) {
    payload.id = todo.id
  }

  return payload
}

/**
 * Insert с авто-повтором под частые ошибки схемы.
 */
export async function insertTodoRow(supabase, todo, userId) {
  let payload = toDbPayload(todo, userId)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabase
      .from('todos')
      .insert(payload)
      .select('*')
      .single()

    if (!error) return { data, error: null }

    const msg = error.message || ''

    if (/habit_id|uuid/i.test(msg) && payload.habit_id != null) {
      payload = { ...payload, habit_id: null }
      continue
    }

    if (/out of range for type integer/i.test(msg)) {
      payload = { ...payload, sort_order: attempt }
      continue
    }

    if (/column .*title/i.test(msg) || /null value in column "title"/i.test(msg)) {
      payload = { ...payload, title: payload.text }
      continue
    }

    if (/Could not find the 'title' column/i.test(msg)) {
      const { title: _drop, ...rest } = payload
      payload = rest
      continue
    }

    if (/Could not find the 'text' column/i.test(msg) && payload.title) {
      const { text: _drop, ...rest } = payload
      payload = rest
      continue
    }

    return { data: null, error }
  }

  return {
    data: null,
    error: { message: 'Не удалось сохранить задачу после повторов' },
  }
}
