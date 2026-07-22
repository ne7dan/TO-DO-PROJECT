import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { PeriodTabs } from './components/PeriodTabs'
import { TodoList } from './components/TodoList'
import { HabitTracker } from './components/HabitTracker'
import { Calendar } from './components/Calendar'
import { Pomodoro } from './components/Pomodoro'
import { QuickStats } from './components/QuickStats'
import { useTheme } from './hooks/useTheme'
import { useTodos } from './hooks/useTodos'
import { useHabits } from './hooks/useHabits'
import { toDateKey } from './utils/dates'

export default function App() {
  const { isDark, toggleTheme } = useTheme()
  const {
    todos: allTodos,
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
    dayStatuses,
    periodCounts,
    periodHasActive,
    streak,
    freezesLeft,
  } = useTodos()

  const {
    habits,
    addHabit,
    toggleHabit,
    setHabitCompletion,
    skipHabitForDate,
    deleteHabit,
  } = useHabits()

  const [activePeriod, setActivePeriod] = useState('day')
  const [selectedDate, setSelectedDate] = useState(() => toDateKey())
  const [focusTask, setFocusTask] = useState(null)

  const todos = useMemo(
    () =>
      getTodosByPeriod(
        activePeriod,
        activePeriod === 'day' ? selectedDate : undefined,
      ),
    [getTodosByPeriod, activePeriod, selectedDate],
  )

  const focusOptions = useMemo(() => {
    const today = toDateKey()
    return allTodos
      .filter(
        (todo) =>
          !todo.completed && todo.period === 'day' && todo.date === today,
      )
      .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
  }, [allTodos])

  useEffect(() => {
    ensureHabitGoals(habits, selectedDate)
  }, [habits, selectedDate, ensureHabitGoals])

  useEffect(() => {
    if (!focusTask) return
    const today = toDateKey()
    const current = allTodos.find((t) => t.id === focusTask.id)
    if (
      !current ||
      current.completed ||
      current.period !== 'day' ||
      current.date !== today
    ) {
      setFocusTask(null)
      return
    }
    if (
      current.text !== focusTask.text ||
      current.priority !== focusTask.priority ||
      current.estimatedMinutes !== focusTask.estimatedMinutes
    ) {
      setFocusTask(current)
    }
  }, [allTodos, focusTask])

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey)
    setActivePeriod('day')
  }

  const handleProgress = (periodId) =>
    getProgress(periodId, periodId === 'day' ? selectedDate : undefined)

  const handleDropOnCalendar = (todoId, dateKey, { copy = false } = {}) => {
    if (copy) copyTodoToDate(todoId, dateKey)
    else moveTodoToDate(todoId, dateKey)
    setSelectedDate(dateKey)
    setActivePeriod('day')
  }

  const handleAddHabit = useCallback(
    (text) => {
      const habit = addHabit(text)
      if (!habit) return
      ensureHabitGoals([habit, ...habits], selectedDate)
    },
    [addHabit, ensureHabitGoals, habits, selectedDate],
  )

  const handleToggleHabit = useCallback(
    (id, dateKey) => {
      const habit = habits.find((h) => h.id === id)
      const nextCompleted = !Boolean(habit?.completions?.[dateKey])
      toggleHabit(id, dateKey)
      setTodoCompletionByHabit(id, dateKey, nextCompleted)
    },
    [habits, toggleHabit, setTodoCompletionByHabit],
  )

  const handleDeleteHabit = useCallback(
    (id) => {
      deleteHabit(id)
      removeTodosByHabitId(id)
    },
    [deleteHabit, removeTodosByHabitId],
  )

  const handleToggleTodo = useCallback(
    (id) => {
      const todo = allTodos.find((t) => t.id === id)
      if (!todo) return
      const nextCompleted = !todo.completed
      toggleTodo(id)
      if (todo.habitId && todo.period === 'day') {
        setHabitCompletion(todo.habitId, todo.date, nextCompleted)
      }
    },
    [allTodos, toggleTodo, setHabitCompletion],
  )

  const handleDeleteTodo = useCallback(
    (id) => {
      const todo = allTodos.find((t) => t.id === id)
      deleteTodo(id)
      if (todo?.habitId && todo.period === 'day') {
        skipHabitForDate(todo.habitId, todo.date)
      }
    },
    [allTodos, deleteTodo, skipHabitForDate],
  )

  return (
    <div className="min-h-screen text-ink dark:text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 pb-28">
        <Header isDark={isDark} onToggleTheme={toggleTheme} />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 lg:items-start">
          <main className="space-y-4 min-w-0">
            <PeriodTabs
              active={activePeriod}
              onChange={setActivePeriod}
              getProgress={handleProgress}
              periodCounts={periodCounts}
              periodHasActive={periodHasActive}
            />

            <TodoList
              period={activePeriod}
              todos={todos}
              selectedDate={selectedDate}
              onAdd={addTodo}
              onUpdate={updateTodo}
              onToggle={handleToggleTodo}
              onDelete={handleDeleteTodo}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              onFocus={setFocusTask}
              onReorder={reorderTodos}
            />

            <QuickStats
              getTodosByPeriod={getTodosByPeriod}
              periodCounts={periodCounts}
              streak={streak}
              selectedDate={selectedDate}
            />

            <HabitTracker
              habits={habits}
              selectedDate={selectedDate}
              onAdd={handleAddHabit}
              onToggle={handleToggleHabit}
              onDelete={handleDeleteHabit}
            />
          </main>

          <div className="lg:sticky lg:top-8">
            <Calendar
              dayStatuses={dayStatuses}
              streak={streak}
              freezesLeft={freezesLeft}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onDropTodo={handleDropOnCalendar}
            />
          </div>
        </div>
      </div>

      <Pomodoro
        focusTask={focusTask}
        focusOptions={focusOptions}
        onSelectFocus={setFocusTask}
        onClearFocus={() => setFocusTask(null)}
        onTrackFocusTime={addSpentTime}
      />
    </div>
  )
}
