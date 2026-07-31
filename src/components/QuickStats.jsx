import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleDashed, ListTodo } from 'lucide-react'
import { PERIODS } from '../hooks/useTodos'
import { useLocale } from '../i18n/LocaleContext'

export function QuickStats({
  getTodosByPeriod,
  periodCounts,
  streak,
  selectedDate,
}) {
  const { t } = useLocale()
  const [selectedId, setSelectedId] = useState('day')
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const menuId = useId()

  const availablePeriods = PERIODS.filter(
    (period) => period.id === 'day' || (periodCounts[period.id] ?? 0) > 0,
  )

  useEffect(() => {
    if (!availablePeriods.some((p) => p.id === selectedId)) {
      setSelectedId('day')
    }
  }, [availablePeriods, selectedId])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const period = PERIODS.find((p) => p.id === selectedId) ?? PERIODS[0]
  const todos = getTodosByPeriod(
    period.id,
    period.id === 'day' ? selectedDate : undefined,
  )
  const total = todos.length
  const done = todos.filter((todo) => todo.completed).length
  const active = total - done
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)

  const items = [
    { label: t('stats.total'), value: total, icon: ListTodo },
    { label: t('stats.active'), value: active, icon: CircleDashed },
    { label: t('stats.done'), value: done, icon: CheckCircle2 },
  ]

  return (
    <section
      className="animate-slide-up"
      style={{ animationDelay: '140ms' }}
    >
      <article className="ui-card p-4 sm:p-5">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="relative inline-flex" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={menuId}
                className="inline-flex items-center gap-1.5 rounded-xl px-1 -ml-1 py-0.5 text-left transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800/80"
              >
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className={[
                    'shrink-0 text-muted transition-transform duration-200',
                    open ? 'rotate-180' : '',
                  ].join(' ')}
                />
                <h2 className="font-display text-base font-semibold tracking-tight text-ink dark:text-zinc-100">
                  {t(`stats.overview.${period.id}`)}
                </h2>
              </button>

              {open && (
                <ul
                  id={menuId}
                  role="listbox"
                  aria-label={t('stats.pickOverview')}
                  className="absolute left-0 top-full z-20 mt-1.5 min-w-[12.5rem] overflow-hidden rounded-xl border border-black/[0.06] bg-surface shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-lg animate-fade-in"
                >
                  {availablePeriods.map((item) => {
                    const isSelected = item.id === selectedId
                    return (
                      <li key={item.id} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(item.id)
                            setOpen(false)
                          }}
                          className={[
                            'w-full px-3 py-2 text-left text-sm transition-colors',
                            isSelected
                              ? 'bg-[var(--accent-soft)] text-[var(--text-main)] font-medium'
                              : 'text-muted dark:text-[var(--text-muted)] hover:bg-canvas-warm dark:hover:bg-[var(--bg-warm)]',
                          ].join(' ')}
                        >
                          {t(`stats.overview.${item.id}`)}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <p className="text-xs text-muted dark:text-zinc-300 mt-1">
              {t(`period.${period.id}`)}
              {period.id === 'day'
                ? ` · ${t('stats.streak', { streak })}`
                : ''}
            </p>
          </div>

          <p className="text-2xl font-display font-semibold tabular-nums text-ink dark:text-zinc-50">
            {percent}%
          </p>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-warm dark:bg-zinc-800 mb-3">
          <div
            className="h-full rounded-full bg-[var(--accent-color)] transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {items.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="ui-inset px-3 py-2.5 dark:bg-zinc-950/60 dark:border-zinc-700"
            >
              <Icon
                size={14}
                className="text-muted dark:text-zinc-300 mb-1.5"
                strokeWidth={1.75}
              />
              <p className="text-lg font-semibold tabular-nums text-ink dark:text-zinc-50 leading-none">
                {value}
              </p>
              <p className="text-[11px] text-muted dark:text-zinc-300 mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
