import { useState } from 'react'
import { ChevronLeft, ChevronRight, Circle, Plus } from 'lucide-react'
import { TodoItem } from './TodoItem'
import { MetaPicker } from './MetaChips'
import { PERIODS } from '../hooks/useTodos'
import { MAX_TODO_TEXT_LENGTH } from '../utils/text'
import {
  formatDayMeta,
  formatPeriodDeadline,
  parseDateKey,
  toDateKey,
  getWeekStart,
} from '../utils/dates'
import { useLocale } from '../i18n/LocaleContext'

function periodAddDate(period, anchorKey) {
  if (!anchorKey) return toDateKey()
  const anchor = parseDateKey(anchorKey)
  if (period === 'week') return toDateKey(getWeekStart(anchor))
  if (period === 'month') {
    return toDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  }
  if (period === 'year') {
    return toDateKey(new Date(anchor.getFullYear(), 0, 1))
  }
  return anchorKey
}

export function TodoList({
  period,
  todos,
  selectedDate,
  periodAnchorDate,
  onShiftPeriod,
  onAdd,
  onUpdate,
  onToggle,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFocus,
  onReorder,
}) {
  const { t, localeTag, pluralGoals } = useLocale()
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('none')
  const periodMeta = PERIODS.find((p) => p.id === period)
  const showSubtasksHint = period === 'month' || period === 'year'
  const isDay = period === 'day'
  const canShiftPeriod =
    (period === 'day' ||
      period === 'week' ||
      period === 'month' ||
      period === 'year') &&
    typeof onShiftPeriod === 'function'
  const dayMeta =
    isDay && selectedDate ? formatDayMeta(selectedDate, localeTag) : null
  const periodAnchor = periodAnchorDate
    ? parseDateKey(periodAnchorDate)
    : new Date()
  const periodDeadline =
    !isDay && periodMeta
      ? formatPeriodDeadline(period, localeTag, periodAnchor)
      : ''
  const periodLabel = periodMeta ? t(`period.${periodMeta.id}`) : ''
  const deadlineEyebrow =
    period === 'week'
      ? t('todos.deadlineWeek')
      : period === 'month'
        ? t('todos.deadlineMonth')
        : period === 'year'
          ? t('todos.deadlineYear')
          : ''
  const prevLabel =
    period === 'day'
      ? t('todos.prevDay')
      : period === 'week'
        ? t('todos.prevWeek')
        : period === 'month'
          ? t('todos.prevMonth')
          : t('todos.prevYear')
  const nextLabel =
    period === 'day'
      ? t('todos.nextDay')
      : period === 'week'
        ? t('todos.nextWeek')
        : period === 'month'
          ? t('todos.nextMonth')
          : t('todos.nextYear')

  const shiftButtons = canShiftPeriod ? (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onShiftPeriod(-1)}
        aria-label={prevLabel}
        title={prevLabel}
        className="inline-flex h-[32.4px] w-[32.4px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-black/[0.06] bg-surface text-muted shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:bg-transparent dark:border-zinc-600 dark:text-zinc-300 dark:shadow-none hover:bg-canvas-warm dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800 transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => onShiftPeriod(1)}
        aria-label={nextLabel}
        title={nextLabel}
        className="inline-flex h-[32.4px] w-[32.4px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-black/[0.06] bg-surface text-muted shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:bg-transparent dark:border-zinc-600 dark:text-zinc-300 dark:shadow-none hover:bg-canvas-warm dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800 transition-colors"
      >
        <ChevronRight size={16} strokeWidth={1.75} />
      </button>
    </div>
  ) : null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const addDate = isDay
      ? selectedDate
      : periodAddDate(period, periodAnchorDate)
    onAdd(period, text, addDate, {
      priority,
    })
    setText('')
    setPriority('none')
  }

  return (
    <section
      key={`${period}-${periodAnchorDate || selectedDate || ''}`}
      className="ui-card todo-list-surface p-4 sm:p-5 space-y-4 animate-period-swap flex flex-col"
    >
      {dayMeta && (
        <header className="flex items-end justify-between gap-3 pb-1">
          <div className="min-w-0">
            {dayMeta.isToday ? (
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted dark:text-zinc-300 mb-1">
                {t('todos.today')}
              </p>
            ) : (
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted dark:text-zinc-300 mb-1">
                {t('todos.selectedDay')}
              </p>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-display text-lg font-semibold tracking-tight text-ink dark:text-zinc-50 leading-none capitalize truncate">
                <span className="font-customMono tabular-nums mr-1.5">
                  {dayMeta.day}
                </span>
                {dayMeta.month}
              </h3>
              {shiftButtons}
            </div>
          </div>
          <p className="text-xs text-muted dark:text-zinc-300 tabular-nums shrink-0 pb-0.5">
            {todos.length} {pluralGoals(todos.length)}
          </p>
        </header>
      )}

      {!isDay && periodDeadline && (
        <header className="flex items-end justify-between gap-3 pb-1">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted dark:text-zinc-300 mb-1">
              {deadlineEyebrow}
            </p>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-display text-lg font-semibold tracking-tight text-ink dark:text-zinc-50 leading-none capitalize truncate">
                {periodDeadline}
              </h3>
              {shiftButtons}
            </div>
          </div>
          <p className="text-xs text-muted dark:text-zinc-300 tabular-nums shrink-0 pb-0.5">
            {todos.length} {pluralGoals(todos.length)}
          </p>
        </header>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex gap-2">
          <label className="flex flex-1 min-w-0 items-center gap-3 rounded-xl border border-[var(--border-color)] bg-transparent px-3.5 py-3 transition-colors focus-within:border-[var(--accent-color)] focus-within:ring-2 focus-within:ring-[var(--accent-glow)]">
            <Circle
              size={18}
              strokeWidth={1.5}
              className="shrink-0 text-muted dark:text-zinc-400"
              aria-hidden
            />
            <input
              type="text"
              value={text}
              onChange={(e) =>
                setText(e.target.value.slice(0, MAX_TODO_TEXT_LENGTH))
              }
              maxLength={MAX_TODO_TEXT_LENGTH}
              placeholder={
                isDay
                  ? t('todos.newGoal')
                  : periodDeadline
                    ? t('todos.newGoalFor', { period: periodDeadline })
                    : t('todos.newGoalFor', {
                        period: periodLabel.toLowerCase(),
                      })
              }
              className="flex-1 min-w-0 bg-transparent text-sm text-ink dark:text-zinc-50 outline-none placeholder:text-muted dark:placeholder:text-zinc-400"
            />
          </label>
          <button
            type="submit"
            aria-label={t('todos.add')}
            title={t('todos.add')}
            className="inline-flex h-[3.125rem] w-[3.125rem] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--border-color)] bg-transparent text-muted dark:text-zinc-300 transition-colors duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)] hover:border-[color-mix(in_srgb,var(--accent-color)_45%,var(--border-color))] dark:hover:bg-[var(--accent-soft)] dark:hover:text-[var(--accent-muted)]"
          >
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>

        <MetaPicker
          priority={priority}
          onPriorityChange={setPriority}
          t={t}
          compact
        />
      </form>

      {todos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] px-4 py-12 text-center">
          <Circle
            size={28}
            strokeWidth={1.25}
            className="text-muted mb-3"
          />
          <p className="text-sm text-muted dark:text-zinc-300">
            {isDay ? t('todos.emptyDay') : t('todos.empty')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border-color)] flex-1">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              onToggleSubtask={onToggleSubtask}
              onDeleteSubtask={onDeleteSubtask}
              onFocus={onFocus}
              onReorder={onReorder}
              showSubtasksHint={showSubtasksHint}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
