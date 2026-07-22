import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { sanitizeTodoText } from '../utils/text'
import { toDateKey } from '../utils/dates'

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeHabits(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((habit) => {
      if (!habit || typeof habit !== 'object') return null
      const text = sanitizeTodoText(String(habit.text ?? ''))
      if (!text) return null
      const completions =
        habit.completions && typeof habit.completions === 'object'
          ? habit.completions
          : {}
      const startDate =
        typeof habit.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(habit.startDate)
          ? habit.startDate
          : toDateKey(new Date(habit.createdAt || Date.now()))

      const skippedDates =
        habit.skippedDates && typeof habit.skippedDates === 'object'
          ? habit.skippedDates
          : {}

      return {
        id: habit.id || createId(),
        text,
        createdAt: habit.createdAt || Date.now(),
        startDate,
        completions,
        skippedDates,
      }
    })
    .filter(Boolean)
}

export function useHabits() {
  const [habits, setHabits] = useLocalStorage('todo-habits', [])

  const list = useMemo(() => normalizeHabits(habits), [habits])

  const addHabit = useCallback(
    (text) => {
      const safe = sanitizeTodoText(text)
      if (!safe) return null
      const startDate = toDateKey()
      const habit = {
        id: createId(),
        text: safe,
        createdAt: Date.now(),
        startDate,
        completions: {},
        skippedDates: {},
      }
      setHabits((prev) => [habit, ...normalizeHabits(prev)])
      return habit
    },
    [setHabits],
  )

  const toggleHabit = useCallback(
    (id, dateKey = toDateKey()) => {
      setHabits((prev) =>
        normalizeHabits(prev).map((habit) => {
          if (habit.id !== id) return habit
          if (dateKey < habit.startDate) return habit
          const next = { ...habit.completions }
          if (next[dateKey]) delete next[dateKey]
          else next[dateKey] = true
          return { ...habit, completions: next }
        }),
      )
    },
    [setHabits],
  )

  const setHabitCompletion = useCallback(
    (id, dateKey, completed) => {
      setHabits((prev) =>
        normalizeHabits(prev).map((habit) => {
          if (habit.id !== id) return habit
          if (dateKey < habit.startDate) return habit
          const next = { ...habit.completions }
          if (completed) next[dateKey] = true
          else delete next[dateKey]
          return { ...habit, completions: next }
        }),
      )
    },
    [setHabits],
  )

  const skipHabitForDate = useCallback(
    (id, dateKey) => {
      setHabits((prev) =>
        normalizeHabits(prev).map((habit) => {
          if (habit.id !== id) return habit
          return {
            ...habit,
            skippedDates: { ...habit.skippedDates, [dateKey]: true },
          }
        }),
      )
    },
    [setHabits],
  )

  const deleteHabit = useCallback(
    (id) => {
      setHabits((prev) => normalizeHabits(prev).filter((h) => h.id !== id))
    },
    [setHabits],
  )

  /** Одни и те же привычки на каждый день, начиная с даты создания. */
  const getHabitsForDate = useCallback(
    (dateKey = toDateKey()) =>
      list.filter((habit) => dateKey >= habit.startDate),
    [list],
  )

  const getDoneCount = useCallback(
    (dateKey = toDateKey()) => {
      const dayHabits = getHabitsForDate(dateKey)
      return dayHabits.filter((h) => h.completions[dateKey]).length
    },
    [getHabitsForDate],
  )

  return {
    habits: list,
    addHabit,
    toggleHabit,
    setHabitCompletion,
    skipHabitForDate,
    deleteHabit,
    getHabitsForDate,
    getDoneCount,
  }
}
