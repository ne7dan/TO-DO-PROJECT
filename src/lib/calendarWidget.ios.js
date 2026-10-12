import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  getWeekEnd,
  getWeekStart,
  parseDateKey,
  toDateKey,
  toMonthKey,
} from '../utils/dates'

const WidgetBridge = registerPlugin('WidgetBridge')

function inPeriod(todo, period, dateKey) {
  if (!todo || todo.period !== period) return false
  if (!String(todo.text ?? '').trim() || !todo.date) return false
  if (period === 'day') return todo.date === dateKey
  if (period === 'week') {
    const startKey = toDateKey(getWeekStart(parseDateKey(dateKey)))
    const endKey = toDateKey(getWeekEnd(parseDateKey(dateKey)))
    return todo.date >= startKey && todo.date <= endKey
  }
  if (period === 'month') return toMonthKey(todo.date) === toMonthKey(dateKey)
  if (period === 'year') return todo.date.slice(0, 4) === String(dateKey).slice(0, 4)
  return false
}

export function pickPeriodGoals(todos, period, dateKey = toDateKey(), limit = 8) {
  return (Array.isArray(todos) ? todos : [])
    .filter((todo) => inPeriod(todo, period, dateKey))
    .sort((a, b) => {
      if (!a.completed !== !b.completed) return a.completed ? 1 : -1
      return (Number(a.order) || 0) - (Number(b.order) || 0)
    })
    .slice(0, limit)
    .map((todo) => ({
      id: String(todo.id),
      text: String(todo.text).trim(),
      completed: Boolean(todo.completed),
      date: String(todo.date),
      period,
    }))
}

export function pickTodayGoals(todos) {
  return pickPeriodGoals(todos, 'day')
}

function compactHabits(habits) {
  return (Array.isArray(habits) ? habits : [])
    .filter((habit) => habit?.id && String(habit.text ?? '').trim())
    .map((habit) => ({
      id: String(habit.id),
      text: String(habit.text).trim(),
      startDate: typeof habit.startDate === 'string' ? habit.startDate : '',
      completions:
        habit.completions && typeof habit.completions === 'object'
          ? habit.completions
          : {},
      skippedDates:
        habit.skippedDates && typeof habit.skippedDates === 'object'
          ? habit.skippedDates
          : {},
    }))
}

let pendingSnapshot = null
let flushing = false

async function flushSnapshot() {
  if (flushing) return
  flushing = true
  try {
    while (pendingSnapshot) {
      const snapshot = pendingSnapshot
      pendingSnapshot = null
      await WidgetBridge.updateSnapshot({ json: JSON.stringify(snapshot) })
    }
  } catch (error) {
    console.warn('[widget]', error)
  } finally {
    flushing = false
    if (pendingSnapshot) void flushSnapshot()
  }
}

/**
 * Пишет снимок в App Group и сразу просит WidgetKit перерисовать все виджеты.
 */
export async function syncCalendarWidget({
  streak = 0,
  statuses = {},
  goals = [],
  habits = [],
  completedDays = [],
  freezeDates = [],
  counts = {},
  todos = [],
} = {}) {
  if (Capacitor.getPlatform() !== 'ios') return

  const list = Array.isArray(todos) ? todos : []
  pendingSnapshot = {
    streak: Math.max(0, Number(streak) || 0),
    today: toDateKey(),
    updatedAt: Date.now(),
    statuses: statuses && typeof statuses === 'object' ? statuses : {},
    goals: Array.isArray(goals) && goals.length ? goals.slice(0, 8) : pickPeriodGoals(list, 'day'),
    goalsByPeriod: {
      day: pickPeriodGoals(list, 'day'),
      week: pickPeriodGoals(list, 'week'),
      month: pickPeriodGoals(list, 'month'),
      year: pickPeriodGoals(list, 'year'),
    },
    habits: compactHabits(habits),
    completedDays: Array.isArray(completedDays) ? completedDays : [],
    freezeDates: Array.isArray(freezeDates) ? freezeDates : [],
    counts: counts && typeof counts === 'object' ? counts : {},
  }
  await flushSnapshot()
}
