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
 * Авто-заморозка: если вчера не закрыт, но день до него был в серии —
 * тратим 1 заморозку (макс. 2 в месяц), чтобы не оборвать стрик.
 */
export function applyAutoFreeze(completedDays, freezeDates, todayKey = toDateKey()) {
  const completed = new Set(completedDays)
  const freezes = new Set(freezeDates)
  const yesterday = addDays(todayKey, -1)

  if (completed.has(yesterday) || freezes.has(yesterday)) {
    return freezeDates
  }

  const dayBefore = addDays(yesterday, -1)
  if (!completed.has(dayBefore) && !freezes.has(dayBefore)) {
    return freezeDates
  }

  const monthKey = toMonthKey(yesterday)
  if (countFreezesInMonth(freezeDates, monthKey) >= MAX_FREEZES_PER_MONTH) {
    return freezeDates
  }

  return [...freezeDates, yesterday].sort()
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
