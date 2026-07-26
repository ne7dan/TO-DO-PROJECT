import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { habitFromDbRow, habitToDbPayload } from '../lib/habitMapper'
import { sanitizeTodoText } from '../utils/text'
import { toDateKey } from '../utils/dates'

const LOCAL_KEY = 'todo-habits'

function createId() {
  return crypto.randomUUID()
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
        typeof habit.startDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(habit.startDate)
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

function readLocalHabits() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    return normalizeHabits(JSON.parse(raw))
  } catch {
    return []
  }
}

function clearLocalHabits() {
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    // ignore
  }
}

/**
 * Привычки из Supabase (таблица `habits`) + разовый перенос из localStorage.
 */
export function useHabits(userId) {
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState(null)
  const migratedRef = useRef(false)

  useEffect(() => {
    migratedRef.current = false
    if (!userId) {
      setHabits([])
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setHabits([])
        setLoading(false)
        return
      }

      let list = (data ?? []).map(habitFromDbRow).filter(Boolean)

      // Разовый перенос локальных привычек, если в облаке пусто
      if (list.length === 0 && !migratedRef.current) {
        migratedRef.current = true
        const local = readLocalHabits()
        if (local.length > 0) {
          const rows = local.map((h) => habitToDbPayload(h, userId))
          const { error: upError } = await supabase.from('habits').upsert(rows, {
            onConflict: 'id',
          })
          if (!cancelled && !upError) {
            list = local
            clearLocalHabits()
          } else if (upError) {
            console.error('[habits] migrate', upError.message)
          }
        }
      } else if (list.length > 0) {
        clearLocalHabits()
      }

      if (!cancelled) {
        setHabits(list)
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const list = useMemo(() => normalizeHabits(habits), [habits])

  const persistHabit = useCallback(
    async (habit) => {
      if (!userId) return
      const { error: upError } = await supabase
        .from('habits')
        .upsert(habitToDbPayload(habit, userId), { onConflict: 'id' })
      if (upError) {
        console.error('[habits] upsert', upError.message)
        setError(upError.message)
      }
    },
    [userId],
  )

  const addHabit = useCallback(
    (text) => {
      const safe = sanitizeTodoText(text)
      if (!safe || !userId) return null
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
      void persistHabit(habit)
      return habit
    },
    [persistHabit, userId],
  )

  const toggleHabit = useCallback(
    (id, dateKey = toDateKey()) => {
      setHabits((prev) => {
        const next = normalizeHabits(prev).map((habit) => {
          if (habit.id !== id) return habit
          if (dateKey < habit.startDate) return habit
          const completions = { ...habit.completions }
          if (completions[dateKey]) delete completions[dateKey]
          else completions[dateKey] = true
          const updated = { ...habit, completions }
          void persistHabit(updated)
          return updated
        })
        return next
      })
    },
    [persistHabit],
  )

  const setHabitCompletion = useCallback(
    (id, dateKey, completed) => {
      setHabits((prev) => {
        const next = normalizeHabits(prev).map((habit) => {
          if (habit.id !== id) return habit
          if (dateKey < habit.startDate) return habit
          const completions = { ...habit.completions }
          if (completed) completions[dateKey] = true
          else delete completions[dateKey]
          const updated = { ...habit, completions }
          void persistHabit(updated)
          return updated
        })
        return next
      })
    },
    [persistHabit],
  )

  const skipHabitForDate = useCallback(
    (id, dateKey) => {
      setHabits((prev) => {
        const next = normalizeHabits(prev).map((habit) => {
          if (habit.id !== id) return habit
          const updated = {
            ...habit,
            skippedDates: { ...habit.skippedDates, [dateKey]: true },
          }
          void persistHabit(updated)
          return updated
        })
        return next
      })
    },
    [persistHabit],
  )

  const deleteHabit = useCallback(
    (id) => {
      setHabits((prev) => normalizeHabits(prev).filter((h) => h.id !== id))
      if (!userId) return
      void supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .then(({ error: delError }) => {
          if (delError) {
            console.error('[habits] delete', delError.message)
            setError(delError.message)
          }
        })
    },
    [userId],
  )

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
    loading,
    error,
    addHabit,
    toggleHabit,
    setHabitCompletion,
    skipHabitForDate,
    deleteHabit,
    getHabitsForDate,
    getDoneCount,
  }
}
