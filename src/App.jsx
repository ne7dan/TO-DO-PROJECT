import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { PeriodTabs } from './components/PeriodTabs'
import { TodoList } from './components/TodoList'
import { HabitTracker } from './components/HabitTracker'
import { Calendar } from './components/Calendar'
import { Pomodoro } from './components/Pomodoro'
import { QuickStats } from './components/QuickStats'
import { AuthScreen } from './components/auth/AuthScreen'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { useTodos } from './hooks/useTodos'
import { useHabits } from './hooks/useHabits'
import { useLocale } from './i18n/LocaleContext'
import { toDateKey } from './utils/dates'
import { isSupabaseConfigured } from './supabaseClient'

/** Основной экран приложения после успешной авторизации. */
function TodoApp({ user, onSignOut, onRequestPasswordReset }) {
  const { t } = useLocale()
  const { isDark, toggleTheme } = useTheme()
  const {
    todos: allTodos,
    loading: todosLoading,
    error: todosError,
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
    dayGoalCounts,
    periodCounts,
    periodHasActive,
    streak,
    freezesLeft,
  } = useTodos(user?.id)

  const {
    habits,
    addHabit,
    toggleHabit,
    setHabitCompletion,
    skipHabitForDate,
    deleteHabit,
  } = useHabits(user?.id)

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
    if (todosLoading) return
    void ensureHabitGoals(habits, selectedDate)
  }, [habits, selectedDate, ensureHabitGoals, todosLoading])

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
    if (copy) void copyTodoToDate(todoId, dateKey)
    else void moveTodoToDate(todoId, dateKey)
    setSelectedDate(dateKey)
    setActivePeriod('day')
  }

  const handleAddHabit = useCallback(
    (text) => {
      const habit = addHabit(text)
      if (!habit) return
      void ensureHabitGoals([habit, ...habits], selectedDate)
    },
    [addHabit, ensureHabitGoals, habits, selectedDate],
  )

  const handleToggleHabit = useCallback(
    (id, dateKey) => {
      const habit = habits.find((h) => h.id === id)
      const nextCompleted = !Boolean(habit?.completions?.[dateKey])
      toggleHabit(id, dateKey)
      void setTodoCompletionByHabit(id, dateKey, nextCompleted)
    },
    [habits, toggleHabit, setTodoCompletionByHabit],
  )

  const handleDeleteHabit = useCallback(
    (id) => {
      deleteHabit(id)
      void removeTodosByHabitId(id)
    },
    [deleteHabit, removeTodosByHabitId],
  )

  const handleToggleTodo = useCallback(
    (id) => {
      const todo = allTodos.find((t) => t.id === id)
      if (!todo) return
      const nextCompleted = !todo.completed
      void toggleTodo(id)
      if (todo.habitId && todo.period === 'day') {
        setHabitCompletion(todo.habitId, todo.date, nextCompleted)
      }
    },
    [allTodos, toggleTodo, setHabitCompletion],
  )

  const handleDeleteTodo = useCallback(
    (id) => {
      const todo = allTodos.find((t) => t.id === id)
      void deleteTodo(id)
      if (todo?.habitId && todo.period === 'day') {
        skipHabitForDate(todo.habitId, todo.date)
      }
    },
    [allTodos, deleteTodo, skipHabitForDate],
  )

  return (
    <div className="min-h-screen text-ink dark:text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 pb-28">
        <Header
          isDark={isDark}
          onToggleTheme={toggleTheme}
          user={user}
          userEmail={user?.email}
          onSignOut={onSignOut}
          onRequestPasswordReset={onRequestPasswordReset}
        />

        {todosError && (
          <p
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            role="alert"
          >
            {todosError}
          </p>
        )}

        {todosLoading ? (
          <p className="mt-10 text-sm text-muted dark:text-zinc-400">
            {t('auth.loadingTodos')}
          </p>
        ) : (
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
                dayGoalCounts={dayGoalCounts}
                streak={streak}
                freezesLeft={freezesLeft}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                onDropTodo={handleDropOnCalendar}
              />
            </div>
          </div>
        )}
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

/**
 * Корень: пока нет session — форма логина/регистрации,
 * после входа — список Todo из Supabase.
 */
export default function App() {
  const { t } = useLocale()
  const {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    recoveryMode,
    clearRecoveryMode,
  } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="font-display text-xl font-semibold text-ink dark:text-zinc-50">
            Нет настроек Supabase
          </h1>
          <p className="text-sm text-muted dark:text-zinc-400">
            На Vercel добавьте переменные{' '}
            <code className="text-ink dark:text-zinc-200">VITE_SUPABASE_URL</code> и{' '}
            <code className="text-ink dark:text-zinc-200">
              VITE_SUPABASE_PUBLISHABLE_KEY
            </code>
            , затем сделайте Redeploy.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted dark:text-zinc-400">
        {t('auth.loading')}
      </div>
    )
  }

  // Ссылка из письма сброса пароля — форма нового пароля
  if (recoveryMode) {
    return (
      <AuthScreen
        signIn={signIn}
        signUp={signUp}
        requestPasswordReset={requestPasswordReset}
        updatePassword={updatePassword}
        recoveryMode
        clearRecoveryMode={clearRecoveryMode}
      />
    )
  }

  if (!session) {
    return (
      <AuthScreen
        signIn={signIn}
        signUp={signUp}
        requestPasswordReset={requestPasswordReset}
        updatePassword={updatePassword}
        recoveryMode={false}
        clearRecoveryMode={clearRecoveryMode}
      />
    )
  }

  return (
    <TodoApp
      user={user}
      onSignOut={signOut}
      onRequestPasswordReset={requestPasswordReset}
    />
  )
}
