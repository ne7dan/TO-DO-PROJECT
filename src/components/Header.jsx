import { useState } from 'react'
import { LogOut, User } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext'
import { ProfileModal } from './ProfileModal'

export function Header({
  isDark,
  onToggleTheme,
  onModeChange,
  bgTheme,
  accent,
  onBgThemeChange,
  onAccentChange,
  user,
  userEmail,
  onSignOut,
  onRequestPasswordReset,
}) {
  const { t } = useLocale()
  const [profileOpen, setProfileOpen] = useState(false)

  const nickname = user?.user_metadata?.nickname
  const subtitle = nickname || userEmail

  return (
    <>
      <header className="app-header relative z-40 flex items-start justify-between gap-4 animate-fade-in">
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
          {user && (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label={t('profile.open')}
              title={t('profile.open')}
              className="ui-chip touch-target flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-[var(--bg-warm)] active:bg-[var(--bg-warm)]"
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
              className="ui-chip btn-danger-hover touch-target flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-soft"
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
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        onModeChange={onModeChange}
        bgTheme={bgTheme}
        accent={accent}
        onBgThemeChange={onBgThemeChange}
        onAccentChange={onAccentChange}
      />
    </>
  )
}
