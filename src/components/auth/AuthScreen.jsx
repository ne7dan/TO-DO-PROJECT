import { useCallback, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { SignUpForm } from './SignUpForm'
import { RecoveryPasswordForm } from './RecoveryPasswordForm'
import { useLocale } from '../../i18n/LocaleContext'
import { useTheme } from '../../hooks/useTheme'
import { ThemeCustomizer } from '../ThemeCustomizer'

/**
 * Экран входа/регистрации / сброса пароля.
 */
export function AuthScreen({
  signIn,
  signUp,
  requestPasswordReset,
  updatePassword,
  recoveryMode,
  clearRecoveryMode,
}) {
  const { locale, t, toggleLocale } = useLocale()
  const {
    isDark,
    toggleTheme,
    bgTheme,
    setBgTheme,
    accent,
    setAccent,
  } = useTheme()
  const nextLocale = locale === 'ru' ? 'EN' : 'RU'
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [lockedUntil, setLockedUntil] = useState(null)

  const clearLock = useCallback(() => {
    setLockedUntil(null)
    setError((prev) => (prev === 'login_locked' ? null : prev))
  }, [])

  const handleLogin = async (email, password) => {
    setLoading(true)
    setError(null)
    setInfo(null)
    const result = await signIn(email, password)
    if (!result.ok) {
      setError(result.error)
      if (result.lockedUntil) {
        setLockedUntil(result.lockedUntil)
      } else if (result.retryAfterSeconds > 0) {
        setLockedUntil(
          new Date(Date.now() + result.retryAfterSeconds * 1000).toISOString(),
        )
      }
    } else {
      setLockedUntil(null)
    }
    setLoading(false)
  }

  const handleSignUp = async (email, password, nickname) => {
    setLoading(true)
    setError(null)
    setInfo(null)
    const result = await signUp(email, password, nickname)
    if (!result.ok) {
      setError(result.error)
    } else if (!result.data?.session) {
      setInfo(t('auth.checkEmail'))
      setMode('login')
    }
    setLoading(false)
  }

  const handleForgot = async (identifier) => {
    setError(null)
    setInfo(null)
    if (!String(identifier ?? '').trim()) {
      setError(t('auth.forgotNeedId'))
      return
    }
    setLoading(true)
    const result = await requestPasswordReset(identifier)
    setLoading(false)
    if (!result.ok) {
      setError(
        result.error === 'nickname_not_found'
          ? t('auth.nicknameNotFound')
          : result.error === 'empty_login'
            ? t('auth.loginRequired')
            : result.error === 'email_rate_limit'
              ? t('auth.emailRateLimit')
              : result.error,
      )
      return
    }
    setInfo(t('auth.resetEmailSent'))
  }

  const handleUpdatePassword = async (password) => {
    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)
    if (result.ok) setInfo(t('auth.passwordUpdated'))
    return result
  }

  return (
    <div className="app-header min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="relative z-40 flex justify-end gap-2 mb-3">
          <button
            type="button"
            onClick={toggleLocale}
            aria-label={
              locale === 'ru' ? t('header.langToEn') : t('header.langToRu')
            }
            title={locale === 'ru' ? t('header.langToEn') : t('header.langToRu')}
            className="ui-chip touch-target flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl px-2.5 font-customMono text-[11px] font-bold tracking-wide text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800"
          >
            {nextLocale}
          </button>

          <ThemeCustomizer
            bgTheme={bgTheme}
            accent={accent}
            isDark={isDark}
            onBgThemeChange={setBgTheme}
            onAccentChange={setAccent}
          />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              isDark ? t('header.themeToLight') : t('header.themeToDark')
            }
            className="ui-chip touch-target flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-soft dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 transition-colors hover:bg-canvas-warm dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800"
          >
            {isDark ? (
              <Sun size={18} strokeWidth={1.75} />
            ) : (
              <Moon size={18} strokeWidth={1.75} />
            )}
          </button>
        </div>

        <div className="ui-card p-6 sm:p-8 space-y-6">
          <div>
            <p className="font-display text-xs tracking-[0.2em] uppercase text-muted dark:text-zinc-400 mb-1">
              {t('header.tagline')}
            </p>
            <h1
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-3xl font-semibold tracking-tight leading-none text-ink dark:text-zinc-50"
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
            <p className="mt-2 text-sm text-muted dark:text-zinc-400">
              {recoveryMode
                ? t('auth.recoveryHint')
                : mode === 'login'
                  ? t('auth.loginHint')
                  : t('auth.signUpHint')}
            </p>
          </div>

          {!recoveryMode && (
            <div className="flex rounded-xl border border-black/[0.06] dark:border-zinc-700 p-1 bg-canvas-warm/60 dark:bg-zinc-950/60">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setInfo(null)
                }}
                className={[
                  'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                  mode === 'login'
                    ? 'bg-surface dark:bg-zinc-800 text-ink dark:text-zinc-50 shadow-sm'
                    : 'text-muted dark:text-zinc-400',
                ].join(' ')}
              >
                {t('auth.tabLogin')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setInfo(null)
                }}
                className={[
                  'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                  mode === 'signup'
                    ? 'bg-surface dark:bg-zinc-800 text-ink dark:text-zinc-50 shadow-sm'
                    : 'text-muted dark:text-zinc-400',
                ].join(' ')}
              >
                {t('auth.tabSignUp')}
              </button>
            </div>
          )}

          {info && (
            <p className="text-sm text-[#3A5F73] dark:text-sky-300" role="status">
              {info}
            </p>
          )}

          {recoveryMode ? (
            <RecoveryPasswordForm
              onSubmit={handleUpdatePassword}
              onCancel={clearRecoveryMode}
              loading={loading}
            />
          ) : mode === 'login' ? (
            <LoginForm
              onSubmit={handleLogin}
              onForgotPassword={handleForgot}
              loading={loading}
              error={error}
              lockedUntil={lockedUntil}
              onLockExpired={clearLock}
            />
          ) : (
            <SignUpForm
              onSubmit={handleSignUp}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  )
}
