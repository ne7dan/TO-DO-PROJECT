import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

const THEME_COLORS = {
  light: '#f5f6f8',
  dark: '#09090b',
}

function syncThemeColor(theme) {
  let meta = document.querySelector('meta[name="theme-color"][data-app-theme]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('data-app-theme', 'true')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', THEME_COLORS[theme] ?? THEME_COLORS.light)
}

export function useTheme() {
  const [theme, setTheme] = useLocalStorage('todo-theme', 'light')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    syncThemeColor(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme, isDark: theme === 'dark' }
}
