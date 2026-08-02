import { useCallback, useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'
import {
  ACCENT_STORAGE_KEY,
  BG_THEME_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_BG_THEME,
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  applyAppearance,
  normalizeAccent,
  normalizeBgTheme,
  normalizeMode,
} from '../utils/appearance'

/**
 * Режим светлый/тёмный + фон темы + акцентный цвет.
 * Атрибуты `data-theme` / `data-accent` и класс `dark` на <html>.
 */
export function useTheme() {
  const [mode, setMode] = useLocalStorage(MODE_STORAGE_KEY, DEFAULT_MODE)
  const [bgTheme, setBgThemeRaw] = useLocalStorage(
    BG_THEME_STORAGE_KEY,
    DEFAULT_BG_THEME,
  )
  const [accent, setAccentRaw] = useLocalStorage(
    ACCENT_STORAGE_KEY,
    DEFAULT_ACCENT,
  )

  const safeMode = normalizeMode(mode)
  const safeBgTheme = normalizeBgTheme(bgTheme)
  const safeAccent = normalizeAccent(accent)

  useEffect(() => {
    applyAppearance({
      mode: safeMode,
      bgTheme: safeBgTheme,
      accent: safeAccent,
    })
  }, [safeMode, safeBgTheme, safeAccent])

  const toggleTheme = useCallback(() => {
    setMode((prev) => (normalizeMode(prev) === 'dark' ? 'light' : 'dark'))
  }, [setMode])

  const setThemeMode = useCallback(
    (next) => {
      setMode(normalizeMode(next))
    },
    [setMode],
  )

  const setBgTheme = useCallback(
    (next) => {
      setBgThemeRaw(normalizeBgTheme(next))
    },
    [setBgThemeRaw],
  )

  const setAccent = useCallback(
    (next) => {
      setAccentRaw(normalizeAccent(next))
    },
    [setAccentRaw],
  )

  return {
    theme: safeMode,
    toggleTheme,
    setThemeMode,
    isDark: safeMode === 'dark',
    bgTheme: safeBgTheme,
    setBgTheme,
    accent: safeAccent,
    setAccent,
  }
}
