import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { getWeekStart, parseDateKey } from '../utils/dates'
import { displayTodoText } from '../utils/text'

const STORAGE_KEY = 'todo-goal-reminders'
const ID_BASE = 82000
const ID_SPAN = 10000

function reminderNotificationId(todoId) {
  const raw = String(todoId ?? '')
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0
  }
  return ID_BASE + (Math.abs(hash) % ID_SPAN)
}

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

export function normalizeReminderTime(value) {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function normalizeReminder(raw) {
  if (typeof raw === 'string') {
    const time = normalizeReminderTime(raw)
    return time ? { time } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const time = normalizeReminderTime(raw.time)
  if (!time) return null
  const weekday = Number(raw.weekday)
  const monthDay = Number(raw.monthDay)
  const month = Number(raw.month)
  return {
    time,
    weekday: weekday >= 1 && weekday <= 7 ? weekday : undefined,
    monthDay: monthDay >= 1 && monthDay <= 31 ? monthDay : undefined,
    month: month >= 1 && month <= 12 ? month : undefined,
  }
}

export function getReminder(todoId) {
  if (!todoId) return null
  return normalizeReminder(readMap()[todoId])
}

export function getReminderTime(todoId) {
  return getReminder(todoId)?.time ?? null
}

export function setReminder(todoId, config) {
  const nextCfg = normalizeReminder(config)
  if (!todoId || !nextCfg) return null
  const next = readMap()
  next[todoId] = nextCfg
  writeMap(next)
  return nextCfg
}

export function setReminderTime(todoId, hhmm) {
  return setReminder(todoId, { time: hhmm })
}

export function clearReminderTime(todoId) {
  if (!todoId) return
  const next = readMap()
  delete next[todoId]
  writeMap(next)
}

function withTime(date, hhmm) {
  const time = normalizeReminderTime(hhmm)
  if (!date || !time) return null
  const [hour, minute] = time.split(':').map(Number)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
    0,
    0,
  )
}

function fireAt(todo, reminder) {
  if (!todo?.date || !reminder?.time) return null
  const start = parseDateKey(todo.date)
  if (Number.isNaN(start.getTime())) return null

  let day = start
  if (todo.period === 'week') {
    const weekStart = getWeekStart(start)
    const offset = (reminder.weekday ?? 7) - 1
    day = new Date(weekStart)
    day.setDate(weekStart.getDate() + offset)
  } else if (todo.period === 'month') {
    const last = daysInMonth(start.getFullYear(), start.getMonth())
    const md = Math.min(last, reminder.monthDay ?? last)
    day = new Date(start.getFullYear(), start.getMonth(), md)
  } else if (todo.period === 'year') {
    const monthIndex = (reminder.month ?? 12) - 1
    const last = daysInMonth(start.getFullYear(), monthIndex)
    const md = Math.min(last, reminder.monthDay ?? last)
    day = new Date(start.getFullYear(), monthIndex, md)
  }

  const at = withTime(day, reminder.time)
  if (!at || at.getTime() <= Date.now()) return null
  return at
}

async function ensurePermission() {
  if (Capacitor.getPlatform() !== 'ios') return false
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  const next = await LocalNotifications.requestPermissions()
  return next.display === 'granted'
}

export async function cancelTodoReminder(todoId) {
  if (!todoId) return
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: reminderNotificationId(todoId) }],
    })
  } catch {
    /* plugin unavailable */
  }
}

export async function syncTodoReminder(todo, titles = {}) {
  const id = todo?.id
  if (!id) return { ok: false }
  const reminder = getReminder(id)

  if (!reminder || todo.completed) {
    await cancelTodoReminder(id)
    return { ok: true, scheduled: false }
  }

  const at = fireAt(todo, reminder)
  if (!at) {
    await cancelTodoReminder(id)
    return { ok: true, scheduled: false }
  }

  const allowed = await ensurePermission()
  if (!allowed) return { ok: false, error: 'permission' }

  await cancelTodoReminder(id)
  const name = displayTodoText(todo.text)
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: reminderNotificationId(id),
          title: titles.title || 'Flash Todo',
          body: titles.body || name,
          schedule: { at, allowWhileIdle: true },
          sound: 'default',
          extra: { todoId: id },
        },
      ],
    })
    return { ok: true, scheduled: true }
  } catch {
    return { ok: false }
  }
}
