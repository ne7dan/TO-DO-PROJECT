import { PRIORITIES, PRIORITY_DOT, PRIORITY_STYLES } from '../utils/todoMeta'

export function MetaChip({ id, label, selected, onSelect, compact = false }) {
  const isNone = id === 'none'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      aria-pressed={selected}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-all duration-150',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        selected
          ? PRIORITY_STYLES[id]
          : 'border-black/10 dark:border-zinc-700/80 text-muted dark:text-zinc-400 hover:border-black/15 dark:hover:border-zinc-600 hover:text-ink-soft dark:hover:text-zinc-200',
        onSelect ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      {!isNone && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[id]}`}
          aria-hidden
        />
      )}
      {label}
    </button>
  )
}

export function MetaBadge({ id, label }) {
  if (!id || id === 'none') return null

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        PRIORITY_STYLES[id],
      ].join(' ')}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[id]}`}
        aria-hidden
      />
      {label}
    </span>
  )
}

export function MetaPicker({ priority, onPriorityChange, t, compact = false }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted dark:text-zinc-400 mr-0.5">
        {t('meta.priority')}
      </span>
      {PRIORITIES.map((item) => (
        <MetaChip
          key={item.id}
          id={item.id}
          label={
            item.id === 'none' ? t('meta.none') : t(`meta.priority.${item.id}`)
          }
          selected={priority === item.id}
          onSelect={onPriorityChange}
          compact={compact}
        />
      ))}
    </div>
  )
}
