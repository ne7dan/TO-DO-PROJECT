import { PERIODS } from '../hooks/useTodos'
import { useLocale } from '../i18n/LocaleContext'

function LiveDot({ inverted, label }) {
  return (
    <span
      className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5"
      aria-label={label}
      title={label}
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400/80 opacity-75 animate-live-ping" />
      <span
        className={[
          'relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_1.5px_rgba(251,113,133,0.35)]',
          inverted ? 'ring-1 ring-white/80 dark:ring-zinc-900/40' : '',
        ].join(' ')}
      />
    </span>
  )
}

export function PeriodTabs({
  active,
  onChange,
  getProgress,
  periodCounts,
  periodHasActive,
}) {
  const { t } = useLocale()

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-slide-up"
      style={{ animationDelay: '40ms' }}
    >
      {PERIODS.map((period) => {
        const isActive = active === period.id
        const percent = getProgress(period.id)
        const count = periodCounts[period.id] ?? 0
        const isEmptyOptional = period.id !== 'day' && count === 0
        const isDimmed = isEmptyOptional && !isActive
        const isLive = Boolean(periodHasActive[period.id])

        return (
          <button
            key={period.id}
            type="button"
            onClick={() => onChange(period.id)}
            className={[
              'relative rounded-xl px-3 py-3 pr-6 text-left transition-all duration-200 border',
              isActive
                ? 'bg-[#D5E2EA] text-ink border-[#B5C9D4] shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 opacity-100'
                : isDimmed
                  ? 'bg-surface/70 dark:bg-zinc-900/40 border-black/[0.04] dark:border-zinc-700/60 text-muted/70 dark:text-zinc-400 opacity-55 hover:opacity-80'
                  : 'ui-card text-muted dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 opacity-100 hover:border-black/10 dark:hover:border-zinc-500',
            ].join(' ')}
          >
            {isLive && (
              <LiveDot inverted={isActive} label={t('period.live')} />
            )}

            <span
              className={[
                'block text-sm font-medium',
                isActive
                  ? 'text-ink dark:text-zinc-900'
                  : isDimmed
                    ? 'text-muted dark:text-zinc-400'
                    : 'text-ink-soft dark:text-zinc-100',
              ].join(' ')}
            >
              {t(`period.${period.id}`)}
            </span>
            <span
              className={[
                'mt-1 block text-[11px] tabular-nums',
                isActive
                  ? 'text-muted dark:text-zinc-500'
                  : 'text-muted dark:text-zinc-400',
              ].join(' ')}
            >
              {percent}%
            </span>
            <div
              className={[
                'mt-2 h-1 w-full overflow-hidden rounded-full',
                isActive
                  ? 'bg-[#C5D5DE] dark:bg-zinc-300'
                  : 'bg-canvas-warm dark:bg-zinc-800',
              ].join(' ')}
            >
              <div
                className={[
                  'h-full rounded-full transition-all duration-500 ease-out',
                  isActive
                    ? 'bg-[#6A92A6] dark:bg-zinc-800'
                    : 'bg-accent-blue dark:bg-zinc-500',
                ].join(' ')}
                style={{ width: `${percent}%` }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
