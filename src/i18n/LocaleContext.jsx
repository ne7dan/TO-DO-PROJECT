import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  interpolate,
  LOCALE_TAG,
  LOCALES,
  pluralGoals,
  translations,
} from './translations'

const LocaleContext = createContext(null)

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useLocalStorage('todo-locale', 'ru')

  const safeLocale = LOCALES.includes(locale) ? locale : 'ru'

  useEffect(() => {
    document.documentElement.lang = safeLocale
  }, [safeLocale])

  const t = useCallback(
    (key, vars) => {
      const dict = translations[safeLocale] ?? translations.ru
      const fallback = translations.ru[key] ?? key
      const value = dict[key] ?? fallback
      return vars ? interpolate(value, vars) : value
    },
    [safeLocale],
  )

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === 'en' ? 'ru' : 'en'))
  }, [setLocale])

  const value = useMemo(
    () => ({
      locale: safeLocale,
      localeTag: LOCALE_TAG[safeLocale],
      t,
      toggleLocale,
      setLocale,
      pluralGoals: (count) => pluralGoals(safeLocale, count),
    }),
    [safeLocale, t, toggleLocale, setLocale],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}
