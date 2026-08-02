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
          'relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500',
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
                ? 'bg-[var(--accent-soft)] text-[var(--text-main)] border-[color-mix(in_srgb,var(--accent-color)_55%,var(--border-color))] opacity-100'
                : isDimmed
                  ? 'bg-transparent border-[var(--border-color)] text-muted opacity-60 hover:opacity-85'
                  : 'bg-transparent border-[var(--border-color)] text-muted hover:border-[color-mix(in_srgb,var(--accent-color)_40%,var(--border-color))] hover:bg-[var(--accent-soft)]/40',
            ].join(' ')}
          >
            {isLive && (
              <LiveDot inverted={isActive} label={t('period.live')} />
            )}

            <span
              className={[
                'block text-sm font-medium',
                isActive
                  ? 'text-[var(--text-main)]'
                  : isDimmed
                    ? 'text-muted dark:text-[var(--text-muted)]'
                    : 'text-ink-soft dark:text-[var(--text-soft)]',
              ].join(' ')}
            >
              {t(`period.${period.id}`)}
            </span>
            <span
              className={[
                'mt-1 block text-[11px] tabular-nums',
                isActive
                  ? 'text-[var(--text-muted)]'
                  : 'text-muted dark:text-[var(--text-muted)]',
              ].join(' ')}
            >
              {percent}%
            </span>
            <div
              className={[
                'mt-2 h-1 w-full overflow-hidden rounded-full',
                isActive
                  ? 'bg-[color-mix(in_srgb,var(--accent-color)_22%,var(--bg-warm))]'
                  : 'bg-canvas-warm dark:bg-[var(--bg-warm)]',
              ].join(' ')}
            >
              <div
                className={[
                  'h-full rounded-full transition-all duration-500 ease-out',
                  isActive
                    ? 'bg-[var(--accent-color)]'
                    : 'bg-[var(--accent-muted)] dark:bg-[color-mix(in_srgb,var(--accent-color)_55%,var(--bg-card))]',
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
