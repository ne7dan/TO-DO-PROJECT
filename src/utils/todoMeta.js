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
  none: 'border-black/10 text-muted dark:border-zinc-700 dark:text-zinc-300',
  low: 'border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-400/50 dark:bg-sky-500/10 dark:text-sky-300',
  medium:
    'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-300',
  high: 'border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-400/50 dark:bg-rose-500/10 dark:text-rose-300',
}

export const PRIORITY_DOT = {
  none: 'bg-black/20 dark:bg-zinc-500',
  low: 'bg-sky-400',
  medium: 'bg-amber-400',
  high: 'bg-rose-400',
}

export function normalizePriority(value) {
  return PRIORITIES.some((p) => p.id === value) ? value : 'none'
}
