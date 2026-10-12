import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Snowflake } from 'lucide-react'
import {
  formatMonthName,
  getMonthGrid,
  shiftMonth,
  toDateKey,
} from '../utils/dates'
import { useLocale } from '../i18n/LocaleContext'
import { TODO_DRAG_TYPE, touchTodoDrag } from '../hooks/useTodos'
import { isIosNative } from '../utils/platform'

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

function getPageStep(viewport) {
  if (!viewport) return 280
  const track = viewport.firstElementChild
  const raw = track ? getComputedStyle(track).columnGap : ''
  const gap = Number.parseFloat(raw)
  return viewport.offsetWidth + (Number.isFinite(gap) ? gap : 28)
}

function paddedMonthGrid(year, month) {
  const cells = getMonthGrid(year, month)
  while (cells.length < 42) cells.push(null)
  return cells
}

function MonthPane({
  year,
  month,
  todayKey,
  selectedDate,
  dayStatuses,
  dayGoalCounts,
  dropTarget,
  setDropTarget,
  onSelectDate,
  onDropTodo,
  t,
  interactive,
}) {
  const cells = paddedMonthGrid(year, month)

  return (
    <div
      className="grid grid-cols-7 gap-1 text-center"
      aria-hidden={!interactive}
    >
      {cells.map((date, index) => {
        if (!date) {
          return (
            <div
              key={`empty-${year}-${month}-${index}`}
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
        const isDrop = interactive && dropTarget === key

        return (
          <button
            key={key}
            type="button"
            tabIndex={interactive ? 0 : -1}
            data-cal-drop={interactive ? key : undefined}
            onClick={() => {
              if (interactive) onSelectDate(key)
            }}
            onDragOver={(e) => {
              if (!interactive) return
              e.preventDefault()
              e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move'
              setDropTarget(key)
            }}
            onDragLeave={() => {
              if (!interactive) return
              setDropTarget((prev) => (prev === key ? null : prev))
            }}
            onDrop={(e) => {
              if (!interactive) return
              e.preventDefault()
              setDropTarget(null)
              const id =
                e.dataTransfer.getData(TODO_DRAG_TYPE) ||
                e.dataTransfer.getData('text/plain')
              if (id) onDropTodo?.(id, key, { copy: e.ctrlKey })
            }}
            onTouchMove={() => {
              if (interactive && touchTodoDrag.id) setDropTarget(key)
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
                : 'bg-canvas-warm text-ink-soft hover:bg-[var(--accent-soft)] active:bg-[var(--accent-soft)] dark:bg-[color-mix(in_srgb,var(--bg-warm)_80%,transparent)] dark:text-[var(--text-muted)] dark:hover:bg-[var(--accent-soft)] dark:active:bg-[var(--accent-soft)]',
              isToday && !isSelected
                ? 'ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent-color)_55%,var(--border-color))]'
                : '',
              isSelected
                ? 'ring-2 ring-inset ring-[var(--accent-color)] z-[1]'
                : '',
              isDrop
                ? 'ring-2 ring-inset ring-[var(--accent-color)] z-[2] bg-[var(--accent-soft)]'
                : '',
              interactive ? '' : 'pointer-events-none',
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
  )
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
  const [swipeX, setSwipeX] = useState(0)
  const [swipeSettling, setSwipeSettling] = useState(false)
  const viewportRef = useRef(null)
  const pendingDeltaRef = useRef(0)
  const swipeRef = useRef({
    x: 0,
    y: 0,
    dx: 0,
    axis: null,
    active: false,
  })
  const weekdays = t('calendar.weekdays').split(',')
  const ios = isIosNative()

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

  const prevMonth = shiftMonth(viewYear, viewMonth, -1)
  const nextMonth = shiftMonth(viewYear, viewMonth, 1)
  const viewDate = new Date(viewYear, viewMonth, 1)

  const goMonth = (delta) => {
    const next = shiftMonth(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
    setSwipeX(0)
    setSwipeSettling(false)
  }

  useEffect(() => {
    if (!ios) return undefined
    const root = viewportRef.current
    if (!root) return undefined

    const onStart = (e) => {
      if (touchTodoDrag.id) return
      const t = e.changedTouches[0]
      if (!t) return
      pendingDeltaRef.current = 0
      swipeRef.current = {
        x: t.clientX,
        y: t.clientY,
        dx: 0,
        axis: null,
        active: true,
      }
      setSwipeSettling(false)
    }

    const onMove = (e) => {
      const s = swipeRef.current
      if (!s.active || touchTodoDrag.id) return
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (!s.axis) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
        s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
      }
      if (s.axis !== 'x') return
      e.preventDefault()
      const step = getPageStep(root)
      const clamped = Math.max(-step, Math.min(step, dx))
      s.dx = clamped
      setSwipeX(clamped)
    }

    const finish = () => {
      const s = swipeRef.current
      if (!s.active) return
      s.active = false
      const dx = s.dx
      const axis = s.axis
      s.axis = null
      s.dx = 0

      if (axis !== 'x' || touchTodoDrag.id) {
        setSwipeSettling(true)
        setSwipeX(0)
        return
      }

      const step = getPageStep(root)
      const threshold = Math.max(48, step * 0.18)
      if (dx <= -threshold) {
        if (Math.abs(dx) >= step * 0.9) {
          const next = shiftMonth(viewYear, viewMonth, 1)
          setSwipeSettling(false)
          setViewYear(next.year)
          setViewMonth(next.month)
          setSwipeX(0)
          return
        }
        pendingDeltaRef.current = 1
        setSwipeSettling(true)
        setSwipeX(-step)
        window.setTimeout(() => {
          if (pendingDeltaRef.current !== 1) return
          pendingDeltaRef.current = 0
          const next = shiftMonth(viewYear, viewMonth, 1)
          setSwipeSettling(false)
          setViewYear(next.year)
          setViewMonth(next.month)
          setSwipeX(0)
        }, 340)
        return
      }
      if (dx >= threshold) {
        if (Math.abs(dx) >= step * 0.9) {
          const next = shiftMonth(viewYear, viewMonth, -1)
          setSwipeSettling(false)
          setViewYear(next.year)
          setViewMonth(next.month)
          setSwipeX(0)
          return
        }
        pendingDeltaRef.current = -1
        setSwipeSettling(true)
        setSwipeX(step)
        window.setTimeout(() => {
          if (pendingDeltaRef.current !== -1) return
          pendingDeltaRef.current = 0
          const next = shiftMonth(viewYear, viewMonth, -1)
          setSwipeSettling(false)
          setViewYear(next.year)
          setViewMonth(next.month)
          setSwipeX(0)
        }, 340)
        return
      }
      pendingDeltaRef.current = 0
      setSwipeSettling(true)
      setSwipeX(0)
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', finish)
    root.addEventListener('touchcancel', finish)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', finish)
      root.removeEventListener('touchcancel', finish)
    }
  }, [ios, viewYear, viewMonth])

  const commitSwipe = () => {
    const delta = pendingDeltaRef.current
    if (!delta) {
      setSwipeSettling(false)
      return
    }
    pendingDeltaRef.current = 0
    const next = shiftMonth(viewYear, viewMonth, delta)
    setSwipeSettling(false)
    setViewYear(next.year)
    setViewMonth(next.month)
    setSwipeX(0)
  }

  const width = viewportRef.current?.offsetWidth || 1
  const preview =
    swipeX > width * 0.28
      ? prevMonth
      : swipeX < -width * 0.28
        ? nextMonth
        : { year: viewYear, month: viewMonth }
  const titleDate = new Date(preview.year, preview.month, 1)

  const paneProps = {
    todayKey,
    selectedDate,
    dayStatuses,
    dayGoalCounts,
    dropTarget,
    setDropTarget,
    onSelectDate,
    onDropTodo,
    t,
  }

  return (
    <aside
      className="ui-card cal-swipe p-4 sm:p-5 space-y-4 animate-slide-up"
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
              {formatMonthName(titleDate, localeTag)}
            </h2>
            <p className="font-customMono text-xs tabular-nums text-muted dark:text-zinc-300 mt-0.5">
              {preview.year}
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
              className="flex items-center gap-1 rounded-xl border border-sky-400/50 bg-sky-500/12 px-2 py-1.5 dark:border-sky-400/40 dark:bg-sky-500/15"
              title={t('calendar.freezeTitle', { n: freezesLeft })}
            >
              <Snowflake
                size={13}
                strokeWidth={1.75}
                className="text-sky-600 dark:text-sky-400"
              />
              <p className="text-xs font-semibold tabular-nums text-sky-700 dark:text-sky-300 leading-none">
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
      </div>

      {ios ? (
        <div ref={viewportRef} className="cal-swipe__viewport">
          <div
            className={[
              'cal-swipe__track',
              swipeSettling ? 'is-settling' : '',
            ].join(' ')}
            style={{
              transform: `translateX(calc(-100% - var(--cal-swipe-gap) + ${swipeX}px))`,
            }}
            onTransitionEnd={(e) => {
              if (e.propertyName !== 'transform') return
              if (e.target !== e.currentTarget) return
              commitSwipe()
            }}
          >
            <div className="cal-swipe__page">
              <MonthPane
                year={prevMonth.year}
                month={prevMonth.month}
                interactive={false}
                {...paneProps}
              />
            </div>
            <div className="cal-swipe__page">
              <MonthPane
                year={viewYear}
                month={viewMonth}
                interactive
                {...paneProps}
              />
            </div>
            <div className="cal-swipe__page">
              <MonthPane
                year={nextMonth.year}
                month={nextMonth.month}
                interactive={false}
                {...paneProps}
              />
            </div>
          </div>
        </div>
      ) : (
        <MonthPane
          year={viewYear}
          month={viewMonth}
          interactive
          {...paneProps}
        />
      )}

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
