import { Moon, Sun } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext'

export function Header({ isDark, onToggleTheme }) {
  const { locale, t, toggleLocale } = useLocale()
  const nextLocale = locale === 'ru' ? 'EN' : 'RU'

  return (
    <header className="flex items-start justify-between gap-4 animate-fade-in">
      <div>
        <p className="font-display text-xs tracking-[0.2em] uppercase text-muted dark:text-zinc-300 mb-1">
          {t('header.tagline')}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink dark:text-zinc-50">
          {t('header.title')}
        </h1>
      </div>

      <div className="flex items-center gap-2 shrink-0 mt-1">
        <button
          type="button"
          onClick={toggleLocale}
          aria-label={locale === 'ru' ? t('header.langToEn') : t('header.langToRu')}
          title={locale === 'ru' ? t('header.langToEn') : t('header.langToRu')}
          className="ui-chip flex h-10 min-w-10 items-center justify-center rounded-xl px-2.5 font-customMono text-[11px] font-bold tracking-wide text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800"
        >
          {nextLocale}
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? t('header.themeToLight') : t('header.themeToDark')}
          className="ui-chip flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800"
        >
          {isDark ? (
            <Sun size={18} strokeWidth={1.75} />
          ) : (
            <Moon size={18} strokeWidth={1.75} />
          )}
        </button>
      </div>
    </header>
  )
}
