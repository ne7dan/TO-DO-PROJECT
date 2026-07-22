import { useCallback, useEffect, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import {
  applyAutoFreeze,
  buildDayStatuses,
  calculateStreak,
  countFreezesInMonth,
  MAX_FREEZES_PER_MONTH,
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

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function sameDays(a, b) {
  if (a.length !== b.length) return false
  return a.every((day, i) => day === b[i])
}

function getOrder(todo) {
  return typeof todo.order === 'number' ? todo.order : todo.createdAt ?? 0
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

export function useTodos() {
  const [todos, setTodos] = useLocalStorage('todo-items', [])
  const [completedDays, setCompletedDays] = useLocalStorage(
    'todo-completed-days',
    [],
  )
  const [freezeDates, setFreezeDates] = useLocalStorage('todo-streak-freezes', [])

  useEffect(() => {
    setTodos((prev) => {
      const normalized = normalizeTodos(prev)
      const needsFix =
        normalized.length !== prev.length ||
        normalized.some(
          (todo, i) =>
            todo.text !== prev[i]?.text ||
            todo.priority !== normalizePriority(prev[i]?.priority) ||
            todo.order !== getOrder(prev[i] ?? {}) ||
            todo.estimatedMinutes !==
              normalizeEstimateMinutes(prev[i]?.estimatedMinutes) ||
            todo.spentSeconds !==
              Math.max(0, Math.floor(Number(prev[i]?.spentSeconds) || 0)) ||
            todo.subtasks.length !== (prev[i]?.subtasks?.length ?? 0) ||
            todo.subtasks.some(
              (s, j) => s.text !== prev[i]?.subtasks?.[j]?.text,
            ),
        )
      return needsFix ? normalized : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setCompletedDays((prev) => {
      const synced = syncCompletedDays(todos, prev)
      return sameDays(synced, prev) ? prev : synced
    })
  }, [todos, setCompletedDays])

  useEffect(() => {
    setFreezeDates((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const next = applyAutoFreeze(completedDays, list)
      return sameDays(next, list) ? prev : next
    })
  }, [completedDays, setFreezeDates])

  const addTodo = useCallback(
    (period, text, dateKey = toDateKey(), meta = {}) => {
      const safeText = sanitizeTodoText(text)
      if (!safeText) return

      setTodos((prev) => {
        const normalized = normalizeTodos(prev)
        const minOrder = normalized.reduce(
          (min, t) => Math.min(min, getOrder(t)),
          Date.now(),
        )
        return [
          {
            id: createId(),
            text: safeText,
            completed: false,
            period,
            date: period === 'day' ? dateKey : toDateKey(),
            subtasks: [],
            priority: normalizePriority(meta.priority),
            estimatedMinutes: normalizeEstimateMinutes(meta.estimatedMinutes),
            spentSeconds: 0,
            habitId: typeof meta.habitId === 'string' ? meta.habitId : null,
            order: minOrder - 1,
            createdAt: Date.now(),
          },
          ...normalized,
        ]
      })
    },
    [setTodos],
  )

  const updateTodo = useCallback(
    (id, patch) => {
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

          return next
        }),
      )
    },
    [setTodos],
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
    },
    [setTodos],
  )

  const reorderTodos = useCallback(
    (draggedId, targetId) => {
      if (!draggedId || !targetId || draggedId === targetId) return

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

        return list.map((t) =>
          orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id) } : t,
        )
      })
    },
    [setTodos],
  )

  const moveTodoToDate = useCallback(
    (id, dateKey) => {
      if (!dateKey) return
      setTodos((prev) => {
        const list = normalizeTodos(prev)
        const todo = list.find((t) => t.id === id)
        if (!todo || todo.period !== 'day') return prev

        const peers = list.filter(
          (t) => t.period === 'day' && t.date === dateKey && t.id !== id,
        )
        const minOrder = peers.reduce(
          (min, t) => Math.min(min, getOrder(t)),
          Date.now(),
        )

        return list.map((t) =>
          t.id === id
            ? {
                ...t,
                date: dateKey,
                order: minOrder - 1,
                habitId: null,
              }
            : t,
        )
      })
    },
    [setTodos],
  )

  const copyTodoToDate = useCallback(
    (id, dateKey) => {
      if (!dateKey) return
      setTodos((prev) => {
        const list = normalizeTodos(prev)
        const todo = list.find((t) => t.id === id)
        if (!todo || todo.period !== 'day') return prev
        if (todo.date === dateKey) return prev

        const peers = list.filter(
          (t) => t.period === 'day' && t.date === dateKey,
        )
        const minOrder = peers.reduce(
          (min, t) => Math.min(min, getOrder(t)),
          Date.now(),
        )

        const clone = {
          ...todo,
          id: createId(),
          date: dateKey,
          completed: false,
          spentSeconds: 0,
          habitId: null,
          order: minOrder - 1,
          createdAt: Date.now(),
          subtasks: todo.subtasks.map((sub) => ({
            ...sub,
            id: createId(),
            completed: false,
          })),
        }

        return [clone, ...list]
      })
    },
    [setTodos],
  )

  /** Материализует цели дня из активных привычек. */
  const ensureHabitGoals = useCallback(
    (habits, dateKey = toDateKey()) => {
      if (!dateKey || !Array.isArray(habits) || habits.length === 0) return

      setTodos((prev) => {
        const list = normalizeTodos(prev)
        const existing = new Set(
          list
            .filter(
              (t) =>
                t.period === 'day' && t.date === dateKey && t.habitId,
            )
            .map((t) => t.habitId),
        )

        const additions = []
        let minOrder = list.reduce(
          (min, t) => Math.min(min, getOrder(t)),
          Date.now(),
        )

        for (const habit of habits) {
          if (!habit?.id || dateKey < habit.startDate) continue
          if (habit.skippedDates?.[dateKey]) continue
          if (existing.has(habit.id)) continue

          minOrder -= 1
          additions.push({
            id: createId(),
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

        if (additions.length === 0) return prev
        return [...additions, ...list]
      })
    },
    [setTodos],
  )

  const removeTodosByHabitId = useCallback(
    (habitId) => {
      if (!habitId) return
      setTodos((prev) =>
        normalizeTodos(prev).filter((t) => t.habitId !== habitId),
      )
    },
    [setTodos],
  )

  const setTodoCompletionByHabit = useCallback(
    (habitId, dateKey, completed) => {
      if (!habitId || !dateKey) return
      setTodos((prev) =>
        normalizeTodos(prev).map((t) =>
          t.habitId === habitId && t.period === 'day' && t.date === dateKey
            ? { ...t, completed: Boolean(completed) }
            : t,
        ),
      )
    },
    [setTodos],
  )

  const toggleTodo = useCallback(
    (id) => {
      setTodos((prev) =>
        normalizeTodos(prev).map((t) =>
          t.id === id ? { ...t, completed: !t.completed } : t,
        ),
      )
    },
    [setTodos],
  )

  const deleteTodo = useCallback(
    (id) => {
      setTodos((prev) => normalizeTodos(prev).filter((t) => t.id !== id))
    },
    [setTodos],
  )

  const addSubtask = useCallback(
    (todoId, text) => {
      const safeText = sanitizeTodoText(text)
      if (!safeText) return

      setTodos((prev) =>
        normalizeTodos(prev).map((t) =>
          t.id === todoId
            ? {
                ...t,
                subtasks: [
                  ...t.subtasks,
                  { id: createId(), text: safeText, completed: false },
                ],
              }
            : t,
        ),
      )
    },
    [setTodos],
  )

  const toggleSubtask = useCallback(
    (todoId, subtaskId) => {
      setTodos((prev) =>
        normalizeTodos(prev).map((t) => {
          if (t.id !== todoId) return t
          const subtasks = t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s,
          )
          return {
            ...t,
            subtasks,
            ...(subtasks.length > 0
              ? { completed: subtasks.every((s) => s.completed) }
              : {}),
          }
        }),
      )
    },
    [setTodos],
  )

  const deleteSubtask = useCallback(
    (todoId, subtaskId) => {
      setTodos((prev) =>
        normalizeTodos(prev).map((t) =>
          t.id === todoId
            ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
            : t,
        ),
      )
    },
    [setTodos],
  )

  const getTodosByPeriod = useCallback(
    (period, dateKey = toDateKey()) => {
      return normalizeTodos(todos)
        .filter((t) => {
          if (t.period !== period) return false
          if (period === 'day') return t.date === dateKey
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
    periodCounts,
    periodHasActive,
    streak,
    freezesLeft,
    freezeDates: safeFreezes,
  }
}
