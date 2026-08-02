export const PRIORITIES = [
  { id: 'none' },
  { id: 'low' },
  { id: 'medium' },
  { id: 'high' },
]

export const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
}

export const PRIORITY_STYLES = {
  none: 'border-[var(--border-color)] text-muted dark:border-zinc-600 dark:text-zinc-300',
  low: 'border-sky-600/40 bg-sky-500/14 text-sky-900 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-300',
  medium:
    'border-amber-600/45 bg-amber-500/14 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300',
  high: 'border-rose-600/45 bg-rose-500/14 text-rose-900 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-300',
}

export const PRIORITY_DOT = {
  none: 'bg-black/20 dark:bg-zinc-500',
  low: 'bg-sky-500 dark:bg-sky-400',
  medium: 'bg-amber-500 dark:bg-amber-400',
  high: 'bg-rose-500 dark:bg-rose-400',
}

export function normalizePriority(value) {
  return PRIORITIES.some((p) => p.id === value) ? value : 'none'
}
