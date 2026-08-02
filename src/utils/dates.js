export function toMonthKey(dateKey = toDateKey()) {
  return String(dateKey).slice(0, 7)
}

export function toDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatMonthName(date, localeTag = 'ru-RU') {
  return date.toLocaleDateString(localeTag, { month: 'long' })
}

export function formatDayMeta(dateKey, localeTag = 'ru-RU') {
  const date = parseDateKey(dateKey)
  const today = toDateKey()
  return {
    isToday: dateKey === today,
    day: date.getDate(),
    month: date.toLocaleDateString(localeTag, { month: 'long' }),
  }
}

/** Понедельник текущей недели (календарь с Пн). */
export function getWeekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

/** Воскресенье текущей недели. */
export function getWeekEnd(date = new Date()) {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

/** Сдвиг на N недель; возвращает dateKey понедельника. */
export function shiftWeek(dateKey, deltaWeeks) {
  const start = getWeekStart(parseDateKey(dateKey))
  start.setDate(start.getDate() + deltaWeeks * 7)
  return toDateKey(start)
}

/** Сдвиг на N месяцев; возвращает 1-е число месяца. */
export function shiftMonthKey(dateKey, deltaMonths) {
  const d = parseDateKey(dateKey)
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + deltaMonths, 1))
}

/** Сдвиг на N лет; возвращает 1 января. */
export function shiftYearKey(dateKey, deltaYears) {
  const d = parseDateKey(dateKey)
  return toDateKey(new Date(d.getFullYear() + deltaYears, 0, 1))
}

function formatDayMonth(date, localeTag) {
  return date.toLocaleDateString(localeTag, {
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Подпись дедлайна периода:
 * week  → «27 июля — 2 августа»
 * month → «август»
 * year  → «2026»
 */
export function formatPeriodDeadline(
  period,
  localeTag = 'ru-RU',
  date = new Date(),
) {
  if (period === 'week') {
    const start = getWeekStart(date)
    const end = getWeekEnd(date)
    const startLabel = formatDayMonth(start, localeTag)
    const endLabel = formatDayMonth(end, localeTag)

    if (
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear()
    ) {
      const month = start.toLocaleDateString(localeTag, { month: 'long' })
      return `${start.getDate()}–${end.getDate()} ${month}`
    }

    return `${startLabel} — ${endLabel}`
  }

  if (period === 'month') {
    const label = date.toLocaleDateString(localeTag, { month: 'long' })
    const nowYear = new Date().getFullYear()
    if (date.getFullYear() !== nowYear) {
      return `${label} ${date.getFullYear()}`
    }
    return label
  }

  if (period === 'year') {
    return String(date.getFullYear())
  }

  return ''
}

export function shiftMonth(year, month, delta) {
  const date = new Date(year, month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []

  for (let i = 0; i < startOffset; i++) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day))
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

export function addDays(dateKey, delta) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + delta)
  return toDateKey(date)
}

export const MAX_FREEZES_PER_MONTH = 2

export function countFreezesInMonth(freezeDates, monthKey) {
  return freezeDates.filter((d) => d.startsWith(monthKey)).length
}

/**
 * Длина серии, заканчивающейся на endKey (выполненные + заморозки).
 */
export function streakEndingAt(
  completedDays,
  freezeDates = [],
  endKey,
) {
  const set = new Set([...completedDays, ...freezeDates])
  if (!endKey || !set.has(endKey)) return 0

  let streak = 0
  let cursor = endKey
  while (set.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/**
 * Авто-заморозка пропуска.
 * Работает ТОЛЬКО если до пропуска уже был стрик (≥ 2 дня подряд).
 * Один одиночный выполненный день заморозку не включает.
 */
export function applyAutoFreeze(completedDays, freezeDates, todayKey = toDateKey()) {
  const completed = new Set(completedDays)
  const freezes = new Set(freezeDates)
  const yesterday = addDays(todayKey, -1)

  if (completed.has(yesterday) || freezes.has(yesterday)) {
    return freezeDates
  }

  const dayBefore = addDays(yesterday, -1)
  // День перед пропуском должен быть реально выполнен (не только старая заморозка)
  if (!completed.has(dayBefore)) {
    return freezeDates
  }

  // Заморозка только после первого настоящего стрика (минимум 2 дня подряд)
  const priorStreak = streakEndingAt(completedDays, freezeDates, dayBefore)
  if (priorStreak < 2) {
    return freezeDates
  }

  const monthKey = toMonthKey(yesterday)
  if (countFreezesInMonth(freezeDates, monthKey) >= MAX_FREEZES_PER_MONTH) {
    return freezeDates
  }

  return [...freezeDates, yesterday].sort()
}

/**
 * Убирает заморозки, поставленные до первого стрика (одиночный день и т.п.).
 */
export function pruneInvalidFreezes(completedDays, freezeDates = []) {
  const sorted = [...(Array.isArray(freezeDates) ? freezeDates : [])].sort()
  const kept = []

  for (const freezeDay of sorted) {
    const dayBefore = addDays(freezeDay, -1)
    const completed = new Set(completedDays)
    if (!completed.has(dayBefore)) continue

    const priorStreak = streakEndingAt(completedDays, kept, dayBefore)
    if (priorStreak < 2) continue

    kept.push(freezeDay)
  }

  return kept
}

export function calculateStreak(
  completedDays,
  freezeDates = [],
  todayKey = toDateKey(),
) {
  const set = new Set([...completedDays, ...freezeDates])
  let cursor = todayKey

  if (!set.has(cursor)) {
    cursor = addDays(todayKey, -1)
    if (!set.has(cursor)) return 0
  }

  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

export function buildDayStatuses(dayTodos, todayKey = toDateKey(), freezeDates = []) {
  const byDate = new Map()
  const freezes = new Set(freezeDates)

  for (const todo of dayTodos) {
    if (!todo?.date) continue
    if (!byDate.has(todo.date)) byDate.set(todo.date, [])
    byDate.get(todo.date).push(todo)
  }

  /** @type {Record<string, 'complete' | 'partial' | 'missed' | 'pending' | 'frozen'>} */
  const statuses = {}

  for (const [date, list] of byDate) {
    if (list.length === 0) continue
    const done = list.filter((t) => t.completed).length
    const isPast = date < todayKey

    if (done === list.length) {
      statuses[date] = 'complete'
    } else if (isPast) {
      statuses[date] = freezes.has(date) ? 'frozen' : 'missed'
    } else if (done > 0) {
      statuses[date] = 'partial'
    } else {
      statuses[date] = 'pending'
    }
  }

  for (const date of freezes) {
    if (!statuses[date] && date < todayKey) {
      statuses[date] = 'frozen'
    }
  }

  return statuses
}
