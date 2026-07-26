/**
 * Маппинг привычек: UI ↔ таблица public.habits.
 */

import { sanitizeTodoText } from '../utils/text'
import { toDateKey } from '../utils/dates'

function asDateMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [key, v] of Object.entries(value)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && v) out[key] = true
  }
  return out
}

export function habitFromDbRow(row) {
  if (!row || typeof row !== 'object') return null
  const text = sanitizeTodoText(String(row.text ?? ''))
  if (!text) return null

  const createdAt =
    typeof row.created_at === 'number'
      ? row.created_at
      : row.created_at
        ? Date.parse(row.created_at)
        : Date.now()

  const startDate =
    typeof row.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.start_date)
      ? row.start_date
      : toDateKey(new Date(Number.isFinite(createdAt) ? createdAt : Date.now()))

  return {
    id: String(row.id),
    text,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    startDate,
    completions: asDateMap(row.completions),
    skippedDates: asDateMap(row.skipped_dates),
  }
}

export function habitToDbPayload(habit, userId) {
  const text = sanitizeTodoText(String(habit.text ?? ''))
  return {
    id: String(habit.id),
    user_id: userId,
    text,
    start_date: habit.startDate,
    completions: asDateMap(habit.completions),
    skipped_dates: asDateMap(habit.skippedDates),
    created_at: new Date(habit.createdAt || Date.now()).toISOString(),
  }
}
