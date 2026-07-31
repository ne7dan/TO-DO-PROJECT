import { useMemo, useState } from 'react'
import { Check, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { MAX_TODO_TEXT_LENGTH } from '../utils/text'
import { formatDayMeta, toDateKey } from '../utils/dates'
import { useLocale } from '../i18n/LocaleContext'

export function HabitTracker({
  habits,
  selectedDate,
  onAdd,
  onToggle,
  onDelete,
}) {
  const { t, localeTag } = useLocale()
  const [text, setText] = useState('')
  const dateKey = selectedDate || toDateKey()
  const dayMeta = formatDayMeta(dateKey, localeTag)

  const dayHabits = useMemo(
    () => habits.filter((habit) => dateKey >= habit.startDate),
    [habits, dateKey],
  )

  const doneCount = useMemo(
    () => dayHabits.filter((h) => h.completions[dateKey]).length,
    [dayHabits, dateKey],
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd(text)
    setText('')
  }

  return (
    <section
      className="ui-card p-4 sm:p-5 space-y-3 animate-slide-up"
      style={{ animationDelay: '100ms' }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted dark:text-zinc-300 mb-1">
            {t('habits.eyebrow')}
            {!dayMeta.isToday && (
              <span className="normal-case tracking-normal text-muted/70">
                {' · '}
                {dayMeta.day} {dayMeta.month}
              </span>
            )}
          </p>
          <h2 className="font-display text-base font-semibold tracking-tight text-ink dark:text-zinc-50">
            {t('habits.title')}
          </h2>
        </div>
        {dayHabits.length > 0 && (
          <p className="text-xs tabular-nums text-muted dark:text-zinc-300 shrink-0">
            {doneCount}/{dayHabits.length}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label className="ui-inset flex flex-1 min-w-0 items-center gap-2.5 px-3 py-2.5 focus-within:border-[#C9DCE6] dark:bg-zinc-950/60 dark:border-zinc-600 dark:focus-within:border-zinc-400">
          <RefreshCw
            size={16}
            strokeWidth={1.75}
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
            placeholder={t('habits.placeholder')}
            className="flex-1 min-w-0 bg-transparent text-sm text-ink dark:text-zinc-50 outline-none placeholder:text-muted/60"
          />
        </label>
        <button
          type="submit"
          aria-label={t('habits.add')}
          className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-black/[0.06] bg-surface text-muted shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:bg-transparent dark:border-zinc-600 dark:text-zinc-300 dark:shadow-none hover:bg-canvas-warm dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800 transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </form>

      {dayHabits.length === 0 ? (
        <p className="text-sm text-muted dark:text-zinc-300 py-2">
          {t('habits.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {dayHabits.map((habit) => {
            const done = Boolean(habit.completions[dateKey])
            return (
              <li
                key={habit.id}
                className="ui-inset flex items-center gap-3 px-3 py-2.5 dark:bg-zinc-950/50 dark:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => onToggle(habit.id, dateKey)}
                  aria-label={
                    done ? t('habits.uncomplete') : t('habits.complete')
                  }
                  className={[
                    'habit-check touch-target flex shrink-0 items-center justify-center rounded-full transition-all',
                    done ? 'text-[var(--accent-contrast)]' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-6 w-6 items-center justify-center rounded-full border transition-all',
                      done
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)] shadow-[0_0_0_3px_var(--accent-glow)]'
                        : 'border-black/15 dark:border-[var(--border-color)] hover:border-[var(--accent-color)] active:border-[var(--accent-color)]',
                    ].join(' ')}
                  >
                    {done && <Check size={14} strokeWidth={2.5} />}
                  </span>
                </button>
                <span
                  className={[
                    'flex-1 text-sm',
                    done
                      ? 'text-muted/70 dark:text-zinc-500 line-through'
                      : 'text-ink-soft dark:text-zinc-100',
                  ].join(' ')}
                >
                  {habit.text}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(habit.id)}
                  aria-label={t('habits.delete')}
                  className="touch-target flex items-center justify-center rounded-xl text-muted hover:text-ink dark:hover:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-zinc-800 active:bg-black/[0.06] dark:active:bg-zinc-800"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
