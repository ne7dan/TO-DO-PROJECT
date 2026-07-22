import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Snowflake } from 'lucide-react'
import {
  formatMonthName,
  getMonthGrid,
  shiftMonth,
  toDateKey,
} from '../utils/dates'
import { useLocale } from '../i18n/LocaleContext'
import { TODO_DRAG_TYPE } from '../hooks/useTodos'

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

  const cells = getMonthGrid(viewYear, viewMonth)
  const viewDate = new Date(viewYear, viewMonth, 1)

  const goMonth = (delta) => {
    const next = shiftMonth(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
  }

  return (
    <aside
      className="ui-card p-4 sm:p-5 space-y-4 animate-slide-up dark:bg-zinc-900 dark:border-zinc-800"
      style={{ animationDelay: '120ms' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label={t('calendar.prevMonth')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] text-muted hover:bg-canvas-warm dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft size={16} />
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] text-muted hover:bg-canvas-warm dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="flex items-center gap-1 rounded-xl border border-[#B5C9D4] bg-[#D5E2EA] dark:border-sky-700/50 dark:bg-sky-950/30 px-2 py-1.5"
            title={t('calendar.freezeTitle', { n: freezesLeft })}
          >
            <Snowflake
              size={13}
              strokeWidth={1.75}
              className="text-[#5A8FA8] dark:text-sky-400"
            />
            <p className="text-xs font-semibold tabular-nums text-[#3A5F73] dark:text-sky-200 leading-none">
              {freezesLeft}
            </p>
          </div>

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

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-[10px] uppercase tracking-wider text-muted dark:text-zinc-300 py-1"
          >
            {day}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }

          const key = toDateKey(date)
          const status = dayStatuses[key]
          const isToday = key === todayKey
          const isSelected = key === selectedDate
          const isDrop = dropTarget === key

          return (
            <button
              key={key}
              type="button"
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
              title={
                status
                  ? `${key}: ${t(`calendar.status.${status}`)}`
                  : t('calendar.dropHint', { date: key })
              }
              className={[
                'aspect-square rounded-xl flex items-center justify-center font-customMono text-xs tabular-nums transition-all duration-200',
                status
                  ? STATUS_STYLES[status]
                  : 'bg-canvas-warm text-muted hover:bg-[#D5E2EA] dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700',
                isToday && !isSelected
                  ? 'ring-1 ring-[#B5C9D4] dark:ring-zinc-500'
                  : '',
                isSelected
                  ? 'ring-2 ring-[#6A92A6] dark:ring-zinc-100 ring-offset-2 ring-offset-surface dark:ring-offset-zinc-900 scale-[1.04] z-[1] shadow-[0_4px_12px_rgba(0,0,0,0.05)]'
                  : '',
                isDrop
                  ? 'ring-2 ring-[#6A92A6] scale-105 z-[2]'
                  : '',
              ].join(' ')}
            >
              {date.getDate()}
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
