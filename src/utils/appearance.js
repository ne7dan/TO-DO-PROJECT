/** Фоновые темы (панели, текст, границы) — light + dark палитры. */
export const BG_THEMES = [
  {
    id: 'cosmic-gray',
    swatchDark: '#242429',
    swatchLight: '#d8dce3',
    metaColorDark: '#141417',
    metaColorLight: '#d8dce3',
  },
  {
    id: 'oled-black',
    swatchDark: '#000000',
    swatchLight: '#ffffff',
    metaColorDark: '#000000',
    metaColorLight: '#ffffff',
  },
  {
    id: 'night-blue',
    swatchDark: '#122548',
    swatchLight: '#c5d8f0',
    metaColorDark: '#07122a',
    metaColorLight: '#c5d8f0',
  },
  {
    /** Пара: sage-light (светлый) + matcha-dark (тёмный) */
    id: 'matcha-sage',
    dataThemeDark: 'matcha-dark',
    dataThemeLight: 'sage-light',
    swatchDark: '#232f2a',
    swatchLight: '#d5e0db',
    metaColorDark: '#1a231f',
    metaColorLight: '#d5e0db',
  },
]

/** Акцентные цвета (кнопки, чекбоксы, таймер, активные даты). */
export const ACCENTS = [
  { id: 'green', swatch: '#10b981' },
  { id: 'teal', swatch: '#2dd4bf' },
  { id: 'blue', swatch: '#38bdf8' },
  { id: 'violet', swatch: '#a78bfa' },
  { id: 'pink', swatch: '#e879f9' },
  { id: 'red', swatch: '#f87171' },
  { id: 'orange', swatch: '#fb923c' },
  { id: 'amber', swatch: '#fbbf24' },
]

export const DEFAULT_MODE = 'dark'
export const DEFAULT_BG_THEME = 'cosmic-gray'
export const DEFAULT_ACCENT = 'green'

export const MODE_STORAGE_KEY = 'todo-theme'
export const BG_THEME_STORAGE_KEY = 'todo-bg-theme'
export const ACCENT_STORAGE_KEY = 'todo-accent'

const BG_THEME_IDS = new Set(BG_THEMES.map((t) => t.id))
const ACCENT_IDS = new Set(ACCENTS.map((a) => a.id))

/** Алиасы старых/режимных id → канонический id в UI/storage. */
const THEME_ALIASES = {
  'matcha-dark': 'matcha-sage',
  'sage-light': 'matcha-sage',
}

export function normalizeBgTheme(value) {
  const aliased = THEME_ALIASES[value] ?? value
  return BG_THEME_IDS.has(aliased) ? aliased : DEFAULT_BG_THEME
}

export function normalizeAccent(value) {
  return ACCENT_IDS.has(value) ? value : DEFAULT_ACCENT
}

export function normalizeMode(value) {
  return value === 'light' || value === 'dark' ? value : DEFAULT_MODE
}

/** Реальный data-theme на <html> (для matcha: sage-light / matcha-dark). */
export function resolveDataTheme(bgTheme, mode) {
  const theme = BG_THEMES.find((t) => t.id === normalizeBgTheme(bgTheme))
  if (!theme) return DEFAULT_BG_THEME
  if (mode === 'light' && theme.dataThemeLight) return theme.dataThemeLight
  if (mode === 'dark' && theme.dataThemeDark) return theme.dataThemeDark
  return theme.id
}

/** Вешает data-theme / data-accent и класс dark на <html>. */
export function applyAppearance({ mode, bgTheme, accent }) {
  const root = document.documentElement
  const nextMode = normalizeMode(mode)
  const nextTheme = normalizeBgTheme(bgTheme)
  const nextAccent = normalizeAccent(accent)
  const dataTheme = resolveDataTheme(nextTheme, nextMode)

  if (nextMode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  root.setAttribute('data-theme', dataTheme)
  root.setAttribute('data-accent', nextAccent)

  syncThemeColorMeta(nextMode, nextTheme)
}

function syncThemeColorMeta(mode, bgTheme) {
  let meta = document.querySelector('meta[name="theme-color"][data-app-theme]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('data-app-theme', 'true')
    document.head.appendChild(meta)
  }

  const found = BG_THEMES.find((t) => t.id === bgTheme)
  if (mode === 'light') {
    meta.setAttribute('content', found?.metaColorLight ?? '#f5f6f8')
    return
  }
  meta.setAttribute('content', found?.metaColorDark ?? '#09090b')
}

/** Читает текущий акцент из CSS (для confetti и т.п.). */
export function readAccentColors() {
  const styles = getComputedStyle(document.documentElement)
  const accent = styles.getPropertyValue('--accent-color').trim() || '#10b981'
  const soft = styles.getPropertyValue('--accent-muted').trim() || accent
  const hover = styles.getPropertyValue('--accent-hover').trim() || accent
  return [accent, soft, hover]
}
