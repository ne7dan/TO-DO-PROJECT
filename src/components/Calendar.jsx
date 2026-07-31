import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Snowflake } from 'lucide-react'
import {
  formatMonthName,
  getMonthGrid,
  shiftMonth,
  toDateKey,
} from '../utils/dates'
import { useLocale } from '../i18n/LocaleContext'
import { TODO_DRAG_TYPE, touchTodoDrag } from '../hooks/useTodos'

const STATUS_STYLES = {
  complete:
    'bg-[#9FC4AE] text-[#1E4534] dark:bg-emerald-400/57 dark:text-emerald-50 font-medium',
  partial:
    'bg-[#D4C09A] text-[#5A401C] dark:bg-amber-400/50 dark:text-amber-50 font-medium',
  missed:
    'bg-[#D4A3AD] text-[#54222E] dark:bg-rose-400/52 dark:text-rose-50 font-medium',
  pending:
    'bg-[#C5C9CF] text-[#3F4752] dark:bg-zinc-700/90 dark:text-zinc-300 font-medium',
  frozen:
    'bg-[#9BBAD0] text-[#294A5E] dark:bg-sky-400/47 dark:text-sky-50 font-medium',
}

export function Calendar({
  dayStatuses,
  dayGoalCounts = {},
  streak,
  freezesLeft = 0,
  selectedDate,
  onSelectDate,
  onDropTodo,
}) {
  const { t, localeTag } = useLocale()
  const todayKey = toDateKey()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [dropTarget, setDropTarget] = useState(null)
  const weekdays = t('calendar.weekdays').split(',')

  useEffect(() => {
    if (!selectedDate) return
    const [y, m] = selectedDate.split('-').map(Number)
    setViewYear(y)
    setViewMonth(m - 1)
  }, [selectedDate])

  useEffect(() => {
    const onTouchCalendarDrop = (e) => {
      const { id, dateKey } = e.detail || {}
      if (id && dateKey) onDropTodo?.(id, dateKey, { copy: false })
      setDropTarget(null)
      touchTodoDrag.id = null
    }
    window.addEventListener('todo-touch-calendar-drop', onTouchCalendarDrop)
    return () => {
      window.removeEventListener('todo-touch-calendar-drop', onTouchCalendarDrop)
    }
  }, [onDropTodo])

  const cells = getMonthGrid(viewYear, viewMonth)
  const viewDate = new Date(viewYear, viewMonth, 1)

  const goMonth = (delta) => {
    const next = shiftMonth(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
  }

  return (
    <aside
      className="ui-card p-4 sm:p-5 space-y-4 animate-slide-up"
      style={{ animationDelay: '120ms' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label={t('calendar.prevMonth')}
            className="touch-target flex shrink-0 items-center justify-center rounded-xl border border-black/[0.06] text-muted hover:bg-canvas-warm dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="min-w-0 px-0.5">
            <h2 className="font-display text-base font-semibold tracking-tight capitalize text-ink dark:text-zinc-50 leading-tight">
              {formatMonthName(viewDate, localeTag)}
            </h2>
            <p className="font-customMono text-xs tabular-nums text-muted dark:text-zinc-300 mt-0.5">
              {viewYear}
            </p>
          </div>

          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label={t('calendar.nextMonth')}
            className="touch-target flex shrink-0 items-center justify-center rounded-xl border border-black/[0.06] text-muted hover:bg-canvas-warm dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {streak >= 1 && (
            <div
              className="flex items-center gap-1 rounded-xl border border-[color-mix(in_srgb,var(--accent-color)_45%,var(--border-color))] bg-[var(--accent-soft)] px-2 py-1.5"
              title={t('calendar.freezeTitle', { n: freezesLeft })}
            >
              <Snowflake
                size={13}
                strokeWidth={1.75}
                className="text-[var(--accent-hover)]"
              />
              <p className="text-xs font-semibold tabular-nums text-[var(--accent-hover)] leading-none">
                {freezesLeft}
              </p>
            </div>
          )}

          <div
            className={[
              'flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-shadow duration-300',
              streak >= 1
                ? 'border-[#D4C09A] bg-[#E8DFD0] shadow-[0_4px_12px_rgba(180,150,100,0.2)] dark:border-amber-500/40 dark:bg-amber-950/30 dark:shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_0_16px_3px_rgba(251,146,60,0.4)]'
                : 'border-black/[0.06] bg-canvas-warm dark:border-zinc-800 dark:bg-zinc-950/50 shadow-none',
            ].join(' ')}
            title={t('calendar.streakTitle')}
          >
            <Flame
              size={15}
              strokeWidth={1.75}
              className={
                streak >= 1
                  ? 'text-[#C4924A] dark:text-amber-400 animate-pulse-soft'
                  : 'text-muted/60'
              }
            />
            <p
              className={[
                'text-sm font-semibold tabular-nums leading-none',
                streak >= 1
                  ? 'text-[#7A5A2A] dark:text-amber-100'
                  : 'text-ink dark:text-zinc-100',
              ].join(' ')}
            >
              {streak}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-[10px] uppercase tracking-wider text-muted dark:text-zinc-300 py-1 truncate"
          >
            {day}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) {
            return (
              <div
                key={`empty-${index}`}
                className="aspect-square min-w-0"
                aria-hidden
              />
            )
          }

          const key = toDateKey(date)
          const status = dayStatuses[key]
          const goalCount = dayGoalCounts[key] || 0
          const isToday = key === todayKey
          const isSelected = key === selectedDate
          const isDrop = dropTarget === key

          return (
            <button
              key={key}
              type="button"
              data-cal-drop={key}
              onClick={() => onSelectDate(key)}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move'
                setDropTarget(key)
              }}
              onDragLeave={() => {
                setDropTarget((prev) => (prev === key ? null : prev))
              }}
              onDrop={(e) => {
                e.preventDefault()
                setDropTarget(null)
                const id =
                  e.dataTransfer.getData(TODO_DRAG_TYPE) ||
                  e.dataTransfer.getData('text/plain')
                if (id) onDropTodo?.(id, key, { copy: e.ctrlKey })
              }}
              onTouchMove={() => {
                if (touchTodoDrag.id) setDropTarget(key)
              }}
              title={
                status
                  ? `${key}: ${t(`calendar.status.${status}`)}${
                      goalCount > 0 ? ` · ${goalCount}` : ''
                    }`
                  : t('calendar.dropHint', { date: key })
              }
              className={[
                'cal-day relative aspect-square min-w-0 w-full rounded-lg',
                'flex items-center justify-center',
                'font-customMono text-[11px] sm:text-xs tabular-nums leading-none',
                'transition-[background-color,box-shadow,color,opacity] duration-200',
                '[&.touch-drag-over]:ring-2 [&.touch-drag-over]:ring-[var(--accent-color)] [&.touch-drag-over]:z-[2]',
                'active:opacity-80',
                status
                  ? STATUS_STYLES[status]
                  : 'bg-canvas-warm text-muted hover:bg-[var(--accent-soft)] active:bg-[var(--accent-soft)] dark:bg-[color-mix(in_srgb,var(--bg-warm)_80%,transparent)] dark:text-[var(--text-muted)] dark:hover:bg-[var(--accent-soft)] dark:active:bg-[var(--accent-soft)]',
                isToday && !isSelected
                  ? 'ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent-color)_55%,var(--border-color))]'
                  : '',
                isSelected
                  ? 'ring-2 ring-inset ring-[var(--accent-color)] z-[1] shadow-[0_0_0_1px_var(--accent-glow)]'
                  : '',
                isDrop
                  ? 'ring-2 ring-inset ring-[var(--accent-color)] z-[2] shadow-[0_0_0_2px_var(--accent-glow)]'
                  : '',
              ].join(' ')}
            >
              {goalCount > 0 && (
                <span
                  className="pointer-events-none absolute top-0.5 right-0.5 min-w-[0.85rem] rounded-full px-0.5 text-[8px] font-semibold leading-tight opacity-90"
                  aria-hidden
                >
                  {goalCount}
                </span>
              )}
              <span className="relative z-0">{date.getDate()}</span>
            </button>
          )
        })}
      </div>

      {selectedDate !== todayKey && (
        <button
          type="button"
          onClick={() => onSelectDate(todayKey)}
          className="w-full rounded-xl border border-black/[0.06] dark:border-zinc-800 px-3 py-2 text-xs text-muted hover:bg-canvas-warm dark:hover:bg-zinc-800/60 transition-colors"
        >
          {t('calendar.backToToday')}
        </button>
      )}
    </aside>
  )
}
