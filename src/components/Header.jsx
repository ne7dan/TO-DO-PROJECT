import { useState } from 'react'
import { LogOut, Moon, Sun, User } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext'
import { ProfileModal } from './ProfileModal'

export function Header({
  isDark,
  onToggleTheme,
  user,
  userEmail,
  onSignOut,
  onRequestPasswordReset,
}) {
  const { locale, t, toggleLocale } = useLocale()
  const nextLocale = locale === 'ru' ? 'EN' : 'RU'
  const [profileOpen, setProfileOpen] = useState(false)

  const nickname = user?.user_metadata?.nickname
  const subtitle = nickname || userEmail

  return (
    <>
      <header className="flex items-start justify-between gap-4 animate-fade-in">
        <div>
          <p className="font-display text-xs tracking-[0.2em] uppercase text-muted dark:text-zinc-300 mb-1">
            {t('header.tagline')}
          </p>
          <h1
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-none text-ink dark:text-zinc-50"
            aria-label={t('header.titleTodo')}
          >
            <span>{t('header.titleTodo')}</span>
            <img
              src="/logo-mark.png"
              alt=""
              width={42}
              height={42}
              className="h-[1.09em] w-[1.09em] shrink-0 object-contain dark:hidden"
              draggable={false}
            />
            <img
              src="/logo-mark-dark.png"
              alt=""
              width={42}
              height={42}
              className="hidden h-[1.09em] w-[1.09em] shrink-0 object-contain dark:block"
              draggable={false}
            />
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-xs text-muted dark:text-zinc-400 truncate max-w-[16rem] sm:max-w-xs">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            type="button"
            onClick={toggleLocale}
            aria-label={
              locale === 'ru' ? t('header.langToEn') : t('header.langToRu')
            }
            title={locale === 'ru' ? t('header.langToEn') : t('header.langToRu')}
            className="ui-chip flex h-10 min-w-10 items-center justify-center rounded-xl px-2.5 font-customMono text-[11px] font-bold tracking-wide text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800"
          >
            {nextLocale}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              isDark ? t('header.themeToLight') : t('header.themeToDark')
            }
            className="ui-chip flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800"
          >
            {isDark ? (
              <Sun size={18} strokeWidth={1.75} />
            ) : (
              <Moon size={18} strokeWidth={1.75} />
            )}
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label={t('profile.open')}
              title={t('profile.open')}
              className="ui-chip flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800"
            >
              <User size={18} strokeWidth={1.75} />
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={() => void onSignOut()}
              aria-label={t('auth.signOut')}
              title={t('auth.signOut')}
              className="ui-chip flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800"
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </header>

      <ProfileModal
        user={user}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onRequestPasswordReset={onRequestPasswordReset}
      />
    </>
  )
}
