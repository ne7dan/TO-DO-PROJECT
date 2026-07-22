import { useState } from 'react'
import { Circle, Plus } from 'lucide-react'
import { TodoItem } from './TodoItem'
import { MetaPicker } from './MetaChips'
import { PERIODS } from '../hooks/useTodos'
import { MAX_TODO_TEXT_LENGTH } from '../utils/text'
import { formatDayMeta } from '../utils/dates'
import { useLocale } from '../i18n/LocaleContext'

export function TodoList({
  period,
  todos,
  selectedDate,
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
  const dayMeta =
    isDay && selectedDate ? formatDayMeta(selectedDate, localeTag) : null
  const periodLabel = periodMeta ? t(`period.${periodMeta.id}`) : ''

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd(period, text, isDay ? selectedDate : undefined, {
      priority,
    })
    setText('')
    setPriority('none')
  }

  return (
    <section
      className="ui-card p-4 sm:p-5 space-y-4 animate-slide-up min-h-[280px] flex flex-col dark:bg-zinc-900 dark:border-zinc-700"
      style={{ animationDelay: '80ms' }}
    >
      {dayMeta && (
        <header className="flex items-end justify-between gap-3 pb-1">
          <div>
            {dayMeta.isToday ? (
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted dark:text-zinc-300 mb-1">
                {t('todos.today')}
              </p>
            ) : (
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted dark:text-zinc-300 mb-1">
                {t('todos.selectedDay')}
              </p>
            )}
            <h3 className="font-display text-lg font-semibold tracking-tight text-ink dark:text-zinc-50 leading-none capitalize">
              <span className="font-customMono tabular-nums mr-1.5">
                {dayMeta.day}
              </span>
              {dayMeta.month}
            </h3>
          </div>
          <p className="text-xs text-muted dark:text-zinc-300 tabular-nums shrink-0 pb-0.5">
            {todos.length} {pluralGoals(todos.length)}
          </p>
        </header>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex gap-2">
          <label className="ui-inset flex flex-1 min-w-0 items-center gap-3 px-3.5 py-3 transition-colors focus-within:border-[#C9DCE6] dark:bg-zinc-950/60 dark:border-zinc-600 focus-within:ring-2 focus-within:ring-[#B7D0DE]/35 dark:focus-within:ring-white/15">
            <Circle
              size={18}
              strokeWidth={1.5}
              className="shrink-0 text-muted/70 dark:text-zinc-400"
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
                  : t('todos.newGoalFor', {
                      period: periodLabel.toLowerCase(),
                    })
              }
              className="flex-1 min-w-0 bg-transparent text-sm text-ink dark:text-zinc-50 outline-none placeholder:text-muted/60 dark:placeholder:text-zinc-400"
            />
          </label>
          <button
            type="submit"
            aria-label={t('todos.add')}
            title={t('todos.add')}
            className="inline-flex h-[3.125rem] w-[3.125rem] shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-surface text-muted shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:bg-transparent dark:border-zinc-600 dark:text-zinc-300 dark:shadow-none transition-colors hover:bg-canvas-warm hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
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
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.08] dark:border-zinc-700 px-4 py-12 text-center bg-canvas-warm/50 dark:bg-transparent">
          <Circle
            size={28}
            strokeWidth={1.25}
            className="text-muted/50 dark:text-zinc-500 mb-3"
          />
          <p className="text-sm text-muted dark:text-zinc-300">
            {isDay ? t('todos.emptyDay') : t('todos.empty')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5 flex-1">
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
