import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fromDbRow, toDbPayload, insertTodoRow, clampSortOrder } from '../lib/todoMapper'
import { createWriteQueue, patchTodoRow } from '../lib/todoSync'
import {
  applyAutoFreeze,
  buildDayStatuses,
  calculateStreak,
  countFreezesInMonth,
  getWeekEnd,
  getWeekStart,
  MAX_FREEZES_PER_MONTH,
  parseDateKey,
  pruneInvalidFreezes,
  toDateKey,
  toMonthKey,
} from '../utils/dates'
import { sanitizeTodoText } from '../utils/text'
import { normalizeEstimateMinutes } from '../utils/estimate'
import { normalizePriority } from '../utils/todoMeta'

export const PERIODS = [
  { id: 'day' },
  { id: 'week' },
  { id: 'month' },
  { id: 'year' },
]

export const TODO_DRAG_TYPE = 'application/x-todo-id'

/** Состояние touch-drag (HTML5 DnD на iOS не работает). */
export const touchTodoDrag = {
  id: null,
}

const SPENT_FLUSH_MS = 4000
const STREAK_PERSIST_MS = 600
const LOCAL_COMPLETED_KEY = 'todo-completed-days'
const LOCAL_FREEZES_KEY = 'todo-streak-freezes'

function createClientId() {
  return crypto.randomUUID()
}

function sameDays(a, b) {
  if (a.length !== b.length) return false
  return a.every((day, i) => day === b[i])
}

function asDateList(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((d) => String(d ?? ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
}

function readLocalDateList(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    return asDateList(JSON.parse(raw))
  } catch {
    return []
  }
}

function clearLocalStreakKeys() {
  try {
    localStorage.removeItem(LOCAL_COMPLETED_KEY)
    localStorage.removeItem(LOCAL_FREEZES_KEY)
  } catch {
    // ignore
  }
}

function getOrder(todo) {
  return clampSortOrder(
    typeof todo.order === 'number' ? todo.order : 0,
  )
}

function normalizeTodos(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((todo) => {
      if (!todo || typeof todo !== 'object') return null
      const text = sanitizeTodoText(String(todo.text ?? ''))
      if (!text) return null
      const subtasks = Array.isArray(todo.subtasks)
        ? todo.subtasks
            .map((sub) => {
              if (!sub || typeof sub !== 'object') return null
              const subText = sanitizeTodoText(String(sub.text ?? ''))
              if (!subText) return null
              return { ...sub, text: subText }
            })
            .filter(Boolean)
        : []
      return {
        ...todo,
        text,
        subtasks,
        priority: normalizePriority(todo.priority),
        order: getOrder(todo),
        estimatedMinutes: normalizeEstimateMinutes(todo.estimatedMinutes),
        spentSeconds: Math.max(0, Math.floor(Number(todo.spentSeconds) || 0)),
        habitId: typeof todo.habitId === 'string' ? todo.habitId : null,
      }
    })
    .filter(Boolean)
}

function syncCompletedDays(todos, prevCompleted) {
  const dayTodos = todos.filter((t) => t.period === 'day')
  const byDate = new Map()

  for (const todo of dayTodos) {
    const key = todo.date
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key).push(todo)
  }

  const next = new Set(prevCompleted)
  for (const [date, list] of byDate) {
    const allDone = list.length > 0 && list.every((t) => t.completed)
    if (allDone) next.add(date)
    else next.delete(date)
  }
  return Array.from(next).sort()
}

/**
 * Todos из Supabase (таблица `todos`) + стрик/заморозки из `user_streak_state`.
 * @param {string | null | undefined} userId — id текущего пользователя Auth
 */
export function useTodos(userId) {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState(null)
  const [completedDays, setCompletedDays] = useState([])
  const [freezeDates, setFreezeDates] = useState([])
  const [streakReady, setStreakReady] = useState(false)

  const todosRef = useRef(todos)
  const spentPendingRef = useRef(new Map())
  const spentTimerRef = useRef(null)
  const writeQueueRef = useRef(createWriteQueue())
  const pendingIdsRef = useRef(new Set())
  const pendingCountRef = useRef(new Map())

  const beginPending = useCallback((id) => {
    const n = (pendingCountRef.current.get(id) || 0) + 1
    pendingCountRef.current.set(id, n)
    pendingIdsRef.current.add(id)
  }, [])

  const endPending = useCallback((id) => {
    const n = (pendingCountRef.current.get(id) || 1) - 1
    if (n <= 0) {
      pendingCountRef.current.delete(id)
      pendingIdsRef.current.delete(id)
    } else {
      pendingCountRef.current.set(id, n)
    }
  }, [])

  todosRef.current = todos

  /** Пишет накопленный spent_seconds в БД пачкой (не каждую секунду). */
  const flushSpentSeconds = useCallback(async () => {
    const pending = spentPendingRef.current
    if (!userId || pending.size === 0) return

    const entries = Array.from(pending.entries())
    pending.clear()

    await Promise.all(
      entries.map(async ([id, seconds]) => {
        const current = todosRef.current.find((t) => t.id === id)
        const value = current?.spentSeconds ?? seconds
        const { error: updateError } = await supabase
          .from('todos')
          .update({ spent_seconds: value })
          .eq('id', id)
          .eq('user_id', userId)
        if (updateError) {
          console.error('[todos] spent_seconds', updateError.message)
        }
      }),
    )
  }, [userId])

  const scheduleSpentFlush = useCallback(() => {
    if (spentTimerRef.current) return
    spentTimerRef.current = setTimeout(() => {
      spentTimerRef.current = null
      void flushSpentSeconds()
    }, SPENT_FLUSH_MS)
  }, [flushSpentSeconds])

  useEffect(() => {
    return () => {
      if (spentTimerRef.current) clearTimeout(spentTimerRef.current)
      void flushSpentSeconds()
    }
  }, [flushSpentSeconds])

  /** Загрузка всех задач пользователя: .select() */
  useEffect(() => {
    if (!userId) {
      setTodos([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function fetchTodos() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setTodos([])
      } else {
        setTodos(
          (data ?? []).map(fromDbRow).filter(Boolean),
        )
      }
      setLoading(false)
    }

    void fetchTodos()
    return () => {
      cancelled = true
    }
  }, [userId])

  /** Мягкое обновление списка (pull-to-refresh) — без полного reload и без сброса UI. */
  const refreshTodos = useCallback(async () => {
    if (!userId) return
    const { data, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setError(null)
    const incoming = (data ?? []).map(fromDbRow).filter(Boolean)
    const pending = pendingIdsRef.current
    if (pending.size === 0) {
      setTodos(incoming)
      return
    }
    setTodos((prev) => {
      const localById = new Map(normalizeTodos(prev).map((t) => [t.id, t]))
      return incoming.map((row) => (pending.has(row.id) ? localById.get(row.id) ?? row : row))
    })
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    const channel = supabase
      .channel(`todos-sync:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id
            if (!deletedId || pendingIdsRef.current.has(deletedId)) return
            setTodos((prev) => prev.filter((t) => t.id !== deletedId))
            return
          }

          const row = fromDbRow(payload.new)
          if (!row || pendingIdsRef.current.has(row.id)) return

          setTodos((prev) => {
            const list = normalizeTodos(prev)
            const idx = list.findIndex((t) => t.id === row.id)
            if (idx === -1) {
              return payload.eventType === 'INSERT' ? [row, ...list] : list
            }
            const next = [...list]
            next[idx] = { ...list[idx], ...row }
            return next
          })
        },
      )
      .subscribe()

    const onResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      void refreshTodos()
    }

    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('online', onResume)
    window.addEventListener('focus', onResume)

    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('online', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [userId, refreshTodos])

  /** Загрузка стрика + разовый перенос из localStorage */
  useEffect(() => {
    if (!userId) {
      setCompletedDays([])
      setFreezeDates([])
      setStreakReady(false)
      return undefined
    }

    let cancelled = false
    setStreakReady(false)

    async function loadStreak() {
      const { data, error: fetchError } = await supabase
        .from('user_streak_state')
        .select('completed_days, freeze_dates')
        .eq('user_id', userId)
        .maybeSingle()

      if (cancelled) return

      if (fetchError) {
        console.error('[streak] load', fetchError.message)
      }

      let completed = asDateList(data?.completed_days)
      let freezes = asDateList(data?.freeze_dates)

      const hasRemote = Boolean(data)
      if (!hasRemote) {
        const localCompleted = readLocalDateList(LOCAL_COMPLETED_KEY)
        const localFreezes = readLocalDateList(LOCAL_FREEZES_KEY)
        if (localCompleted.length > 0 || localFreezes.length > 0) {
          completed = localCompleted
          freezes = localFreezes
          const { error: upError } = await supabase
            .from('user_streak_state')
            .upsert({
              user_id: userId,
              completed_days: completed,
              freeze_dates: freezes,
              updated_at: new Date().toISOString(),
            })
          if (upError) console.error('[streak] migrate', upError.message)
          else clearLocalStreakKeys()
        }
      } else {
        clearLocalStreakKeys()
      }

      if (!cancelled) {
        setCompletedDays(completed)
        setFreezeDates(freezes)
        setStreakReady(true)
      }
    }

    void loadStreak()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!streakReady) return
    setCompletedDays((prev) => {
      const synced = syncCompletedDays(todos, prev)
      return sameDays(synced, prev) ? prev : synced
    })
  }, [todos, streakReady])

  useEffect(() => {
    if (!streakReady) return
    setFreezeDates((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const pruned = pruneInvalidFreezes(completedDays, list)
      const next = applyAutoFreeze(completedDays, pruned)
      return sameDays(next, list) ? prev : next
    })
  }, [completedDays, streakReady])

  /** Сохранение стрика в облако (debounce) */
  useEffect(() => {
    if (!userId || !streakReady) return undefined

    const timer = setTimeout(() => {
      void supabase
        .from('user_streak_state')
        .upsert({
          user_id: userId,
          completed_days: asDateList(completedDays),
          freeze_dates: asDateList(freezeDates),
          updated_at: new Date().toISOString(),
        })
        .then(({ error: upError }) => {
          if (upError) console.error('[streak] save', upError.message)
        })
    }, STREAK_PERSIST_MS)

    return () => clearTimeout(timer)
  }, [userId, streakReady, completedDays, freezeDates])

  /** Оптимистично обновляет локальный список и патчит строку в БД. */
  const patchRemote = useCallback(
    async (id, uiPatch) => {
      if (!userId) return { ok: false }
      beginPending(id)
      let payload = toDbPayload(uiPatch)
      delete payload.id
      delete payload.user_id

      const result = await writeQueueRef.current.enqueue(id, async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const patched = await patchTodoRow(supabase, {
            userId,
            id,
            fields: payload,
          })
          if (patched.ok) return patched
          const msg = patched.error?.message || ''
          if (/habit_id|uuid/i.test(msg) && payload.habit_id != null) {
            payload = { ...payload, habit_id: null }
            continue
          }
          if (/out of range for type integer/i.test(msg)) {
            payload = { ...payload, sort_order: clampSortOrder(attempt) }
            continue
          }
          return patched
        }
        return { ok: false, error: { message: 'Не удалось сохранить задачу' } }
      })

      endPending(id)
      if (!result.ok) {
        const msg = result.error?.message || 'Не удалось сохранить задачу'
        setError(msg)
        console.error('[todos] update', msg)
      }
      return result
    },
    [userId, beginPending, endPending],
  )

  const addTodo = useCallback(
    async (period, text, dateKey = toDateKey(), meta = {}) => {
      const safeText = sanitizeTodoText(text)
      if (!safeText || !userId) return

      const list = normalizeTodos(todosRef.current)
      const minOrder = list.reduce(
        (min, t) => Math.min(min, getOrder(t)),
        0,
      )

      const draft = {
        id: createClientId(),
        text: safeText,
        completed: false,
        period,
        date: dateKey || toDateKey(),
        subtasks: [],
        priority: normalizePriority(meta.priority),
        estimatedMinutes: normalizeEstimateMinutes(meta.estimatedMinutes),
        spentSeconds: 0,
        habitId: typeof meta.habitId === 'string' ? meta.habitId : null,
        order: minOrder - 1,
        createdAt: Date.now(),
      }

      setTodos((prev) => [draft, ...normalizeTodos(prev)])
      beginPending(draft.id)

      const { data, error: insertError } = await writeQueueRef.current.enqueue(
        draft.id,
        () => insertTodoRow(supabase, draft, userId),
      )

      endPending(draft.id)

      if (insertError) {
        setError(insertError.message)
        setTodos((prev) => prev.filter((t) => t.id !== draft.id))
        return
      }

      const saved = fromDbRow(data)
      if (saved) {
        setTodos((prev) =>
          prev.map((t) =>
            t.id === draft.id ? { ...saved, completed: t.completed } : t,
          ),
        )
      }
    },
    [userId, beginPending, endPending],
  )

  const updateTodo = useCallback(
    async (id, patch) => {
      let nextTodo = null
      setTodos((prev) =>
        normalizeTodos(prev).map((todo) => {
          if (todo.id !== id) return todo
          const next = { ...todo }
          if (patch.text !== undefined) {
            const safeText = sanitizeTodoText(patch.text)
            if (!safeText) return todo
            next.text = safeText
          }
          if (patch.priority !== undefined) {
            next.priority = normalizePriority(patch.priority)
          }
          if (patch.estimatedMinutes !== undefined) {
            next.estimatedMinutes = normalizeEstimateMinutes(
              patch.estimatedMinutes,
            )
          }
          if (patch.date !== undefined && todo.period === 'day') {
            next.date = patch.date
          }
          nextTodo = next
          return next
        }),
      )
      if (nextTodo) await patchRemote(id, nextTodo)
    },
    [patchRemote],
  )

  const addSpentTime = useCallback(
    (id, seconds = 1) => {
      const delta = Math.max(0, Math.floor(seconds))
      if (!delta) return

      setTodos((prev) =>
        normalizeTodos(prev).map((todo) =>
          todo.id === id
            ? { ...todo, spentSeconds: (todo.spentSeconds || 0) + delta }
            : todo,
        ),
      )

      const pending = spentPendingRef.current
      pending.set(id, (pending.get(id) || 0) + delta)
      scheduleSpentFlush()
    },
    [scheduleSpentFlush],
  )

  const reorderTodos = useCallback(
    async (draggedId, targetId) => {
      if (!draggedId || !targetId || draggedId === targetId || !userId) return

      let orderUpdates = []
      setTodos((prev) => {
        const list = normalizeTodos(prev)
        const dragged = list.find((t) => t.id === draggedId)
        const target = list.find((t) => t.id === targetId)
        if (!dragged || !target) return prev
        if (dragged.period !== target.period) return prev
        if (dragged.period === 'day' && dragged.date !== target.date) return prev

        const group = list
          .filter((t) => {
            if (t.period !== dragged.period) return false
            if (dragged.period === 'day') return t.date === dragged.date
            return true
          })
          .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1
            return getOrder(a) - getOrder(b)
          })

        const fromIndex = group.findIndex((t) => t.id === draggedId)
        const toIndex = group.findIndex((t) => t.id === targetId)
        if (fromIndex < 0 || toIndex < 0) return prev

        const nextGroup = [...group]
        const [item] = nextGroup.splice(fromIndex, 1)
        nextGroup.splice(toIndex, 0, item)

        const orderMap = new Map()
        nextGroup.forEach((t, i) => orderMap.set(t.id, i))
        orderUpdates = Array.from(orderMap.entries())

        return list.map((t) =>
          orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id) } : t,
        )
      })

      await Promise.all(
        orderUpdates.map(([id, sort_order]) =>
          supabase
            .from('todos')
            .update({ sort_order })
            .eq('id', id)
            .eq('user_id', userId),
        ),
      )
    },
    [userId],
  )

  const moveTodoToDate = useCallback(
    async (id, dateKey) => {
      if (!dateKey || !userId) return
      let nextTodo = null
      setTodos((prev) => {
        const list = normalizeTodos(prev)
        const todo = list.find((t) => t.id === id)
        if (!todo || todo.period !== 'day') return prev

        const peers = list.filter(
          (t) => t.period === 'day' && t.date === dateKey && t.id !== id,
        )
        const minOrder = peers.reduce(
          (min, t) => Math.min(min, getOrder(t)),
          0,
        )

        return list.map((t) => {
          if (t.id !== id) return t
          nextTodo = {
            ...t,
            date: dateKey,
            order: minOrder - 1,
            habitId: null,
          }
          return nextTodo
        })
      })
      if (nextTodo) await patchRemote(id, nextTodo)
    },
    [userId, patchRemote],
  )

  const copyTodoToDate = useCallback(
    async (id, dateKey) => {
      if (!dateKey || !userId) return
      const list = normalizeTodos(todosRef.current)
      const todo = list.find((t) => t.id === id)
      if (!todo || todo.period !== 'day' || todo.date === dateKey) return

      const peers = list.filter(
        (t) => t.period === 'day' && t.date === dateKey,
      )
      const minOrder = peers.reduce(
        (min, t) => Math.min(min, getOrder(t)),
        0,
      )

      const draft = {
        ...todo,
        id: createClientId(),
        date: dateKey,
        completed: false,
        spentSeconds: 0,
        habitId: null,
        order: minOrder - 1,
        createdAt: Date.now(),
        subtasks: todo.subtasks.map((sub) => ({
          ...sub,
          id: createClientId(),
          completed: false,
        })),
      }

      setTodos((prev) => [draft, ...normalizeTodos(prev)])
      beginPending(draft.id)

      const { data, error: insertError } = await writeQueueRef.current.enqueue(
        draft.id,
        () => insertTodoRow(supabase, draft, userId),
      )

      endPending(draft.id)

      if (insertError) {
        setError(insertError.message)
        setTodos((prev) => prev.filter((t) => t.id !== draft.id))
        return
      }

      const saved = fromDbRow(data)
      if (saved) {
        setTodos((prev) =>
          prev.map((t) =>
            t.id === draft.id ? { ...saved, completed: t.completed } : t,
          ),
        )
      }
    },
    [userId, beginPending, endPending],
  )

  const ensureHabitGoals = useCallback(
    async (habits, dateKey = toDateKey()) => {
      if (!userId || !dateKey || !Array.isArray(habits) || habits.length === 0) {
        return
      }

      const list = normalizeTodos(todosRef.current)
      const existing = new Set(
        list
          .filter(
            (t) => t.period === 'day' && t.date === dateKey && t.habitId,
          )
          .map((t) => t.habitId),
      )

      const additions = []
      let minOrder = list.reduce(
        (min, t) => Math.min(min, getOrder(t)),
        0,
      )

      for (const habit of habits) {
        if (!habit?.id || dateKey < habit.startDate) continue
        if (habit.skippedDates?.[dateKey]) continue
        if (existing.has(habit.id)) continue

        minOrder -= 1
        additions.push({
          id: createClientId(),
          text: habit.text,
          completed: Boolean(habit.completions?.[dateKey]),
          period: 'day',
          date: dateKey,
          subtasks: [],
          priority: 'none',
          estimatedMinutes: 0,
          spentSeconds: 0,
          habitId: habit.id,
          order: minOrder,
          createdAt: Date.now(),
        })
      }

      if (additions.length === 0) return

      setTodos((prev) => [...additions, ...normalizeTodos(prev)])

      for (const item of additions) {
        beginPending(item.id)
        const { data, error: insertError } = await writeQueueRef.current.enqueue(
          item.id,
          () => insertTodoRow(supabase, item, userId),
        )
        endPending(item.id)
        if (insertError) {
          setError(insertError.message)
          setTodos((prev) => prev.filter((t) => t.id !== item.id))
          continue
        }
        const saved = fromDbRow(data)
        if (saved) {
          setTodos((prev) =>
            prev.map((t) =>
              t.id === item.id ? { ...saved, completed: t.completed } : t,
            ),
          )
        }
      }
    },
    [userId, beginPending, endPending],
  )

  const removeTodosByHabitId = useCallback(
    async (habitId) => {
      if (!habitId || !userId) return
      const toRemove = normalizeTodos(todosRef.current).filter(
        (t) => t.habitId === habitId,
      )
      setTodos((prev) =>
        normalizeTodos(prev).filter((t) => t.habitId !== habitId),
      )
      if (toRemove.length === 0) return

      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('user_id', userId)
        .eq('habit_id', habitId)

      if (deleteError) {
        setError(deleteError.message)
      }
    },
    [userId],
  )

  const setTodoCompletionByHabit = useCallback(
    async (habitId, dateKey, completed) => {
      if (!habitId || !dateKey || !userId) return
      const targets = []
      setTodos((prev) =>
        normalizeTodos(prev).map((t) => {
          if (
            t.habitId === habitId &&
            t.period === 'day' &&
            t.date === dateKey
          ) {
            const next = { ...t, completed: Boolean(completed) }
            targets.push(next)
            return next
          }
          return t
        }),
      )

      await Promise.all(
        targets.map((todo) => {
          beginPending(todo.id)
          return writeQueueRef.current
            .enqueue(todo.id, () =>
              patchTodoRow(supabase, {
                userId,
                id: todo.id,
                fields: { completed: todo.completed },
              }),
            )
            .finally(() => endPending(todo.id))
        }),
      )
    },
    [userId, beginPending, endPending],
  )

  const toggleTodo = useCallback(
    async (id) => {
      const current = normalizeTodos(todosRef.current).find((t) => t.id === id)
      if (!current || !userId) return

      const nextCompleted = !current.completed
      setTodos((prev) =>
        normalizeTodos(prev).map((t) =>
          t.id === id ? { ...t, completed: nextCompleted } : t,
        ),
      )

      beginPending(id)
      const result = await writeQueueRef.current.enqueue(id, () =>
        patchTodoRow(supabase, {
          userId,
          id,
          fields: { completed: nextCompleted },
        }),
      )
      endPending(id)

      if (!result.ok) {
        setError(result.error?.message || 'Не удалось сохранить задачу')
        setTodos((prev) =>
          normalizeTodos(prev).map((t) =>
            t.id === id ? { ...t, completed: current.completed } : t,
          ),
        )
      }
    },
    [userId, beginPending, endPending],
  )

  const deleteTodo = useCallback(
    async (id) => {
      if (!userId) return
      const snapshot = normalizeTodos(todosRef.current)
      setTodos((prev) => normalizeTodos(prev).filter((t) => t.id !== id))

      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (deleteError) {
        setError(deleteError.message)
        setTodos(snapshot)
      }
    },
    [userId],
  )

  const addSubtask = useCallback(
    async (todoId, text) => {
      const safeText = sanitizeTodoText(text)
      if (!safeText) return
      let nextTodo = null
      setTodos((prev) =>
        normalizeTodos(prev).map((t) => {
          if (t.id !== todoId) return t
          nextTodo = {
            ...t,
            subtasks: [
              ...t.subtasks,
              { id: createClientId(), text: safeText, completed: false },
            ],
          }
          return nextTodo
        }),
      )
      if (nextTodo) await patchRemote(todoId, nextTodo)
    },
    [patchRemote],
  )

  const toggleSubtask = useCallback(
    async (todoId, subtaskId) => {
      let nextTodo = null
      setTodos((prev) =>
        normalizeTodos(prev).map((t) => {
          if (t.id !== todoId) return t
          const subtasks = t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s,
          )
          nextTodo = {
            ...t,
            subtasks,
            ...(subtasks.length > 0
              ? { completed: subtasks.every((s) => s.completed) }
              : {}),
          }
          return nextTodo
        }),
      )
      if (nextTodo) await patchRemote(todoId, nextTodo)
    },
    [patchRemote],
  )

  const deleteSubtask = useCallback(
    async (todoId, subtaskId) => {
      let nextTodo = null
      setTodos((prev) =>
        normalizeTodos(prev).map((t) => {
          if (t.id !== todoId) return t
          nextTodo = {
            ...t,
            subtasks: t.subtasks.filter((s) => s.id !== subtaskId),
          }
          return nextTodo
        }),
      )
      if (nextTodo) await patchRemote(todoId, nextTodo)
    },
    [patchRemote],
  )

  const getTodosByPeriod = useCallback(
    (period, dateKey = toDateKey()) => {
      return normalizeTodos(todos)
        .filter((t) => {
          if (t.period !== period) return false
          if (period === 'day') return t.date === dateKey
          if (!t.date) return false
          if (period === 'week') {
            const startKey = toDateKey(getWeekStart(parseDateKey(dateKey)))
            const endKey = toDateKey(getWeekEnd(parseDateKey(dateKey)))
            return t.date >= startKey && t.date <= endKey
          }
          if (period === 'month') {
            return toMonthKey(t.date) === toMonthKey(dateKey)
          }
          if (period === 'year') {
            return t.date.slice(0, 4) === String(dateKey).slice(0, 4)
          }
          return true
        })
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1
          return getOrder(a) - getOrder(b)
        })
    },
    [todos],
  )

  const getProgress = useCallback(
    (period, dateKey = toDateKey()) => {
      const list = getTodosByPeriod(period, dateKey)
      if (list.length === 0) return 0
      const done = list.filter((t) => t.completed).length
      return Math.round((done / list.length) * 100)
    },
    [getTodosByPeriod],
  )

  const safeFreezes = useMemo(
    () => (Array.isArray(freezeDates) ? freezeDates : []),
    [freezeDates],
  )

  const streak = useMemo(
    () => calculateStreak(completedDays, safeFreezes),
    [completedDays, safeFreezes],
  )

  const freezesLeft = useMemo(() => {
    const used = countFreezesInMonth(safeFreezes, toMonthKey())
    return Math.max(0, MAX_FREEZES_PER_MONTH - used)
  }, [safeFreezes])

  const completedDaysSet = useMemo(
    () => new Set(completedDays),
    [completedDays],
  )

  const dayStatuses = useMemo(
    () =>
      buildDayStatuses(
        normalizeTodos(todos).filter((t) => t.period === 'day'),
        toDateKey(),
        safeFreezes,
      ),
    [todos, safeFreezes],
  )

  /** Сколько day-целей на каждую дату (для календаря). */
  const dayGoalCounts = useMemo(() => {
    const counts = {}
    for (const todo of normalizeTodos(todos)) {
      if (todo.period !== 'day' || !todo.date) continue
      counts[todo.date] = (counts[todo.date] || 0) + 1
    }
    return counts
  }, [todos])

  const periodCounts = useMemo(() => {
    const today = toDateKey()
    const counts = { day: 0, week: 0, month: 0, year: 0 }
    for (const todo of normalizeTodos(todos)) {
      if (!(todo.period in counts)) continue
      if (todo.period === 'day' && todo.date !== today) continue
      counts[todo.period] += 1
    }
    return counts
  }, [todos])

  const periodHasActive = useMemo(() => {
    const today = toDateKey()
    const flags = { day: false, week: false, month: false, year: false }
    for (const todo of normalizeTodos(todos)) {
      if (!(todo.period in flags) || todo.completed) continue
      if (todo.period === 'day' && todo.date !== today) continue
      flags[todo.period] = true
    }
    return flags
  }, [todos])

  return {
    todos,
    loading,
    error,
    refreshTodos,
    addTodo,
    updateTodo,
    addSpentTime,
    reorderTodos,
    moveTodoToDate,
    copyTodoToDate,
    ensureHabitGoals,
    removeTodosByHabitId,
    setTodoCompletionByHabit,
    toggleTodo,
    deleteTodo,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    getTodosByPeriod,
    getProgress,
    completedDaysSet,
    dayStatuses,
    dayGoalCounts,
    periodCounts,
    periodHasActive,
    streak,
    freezesLeft,
    freezeDates: safeFreezes,
  }
}
