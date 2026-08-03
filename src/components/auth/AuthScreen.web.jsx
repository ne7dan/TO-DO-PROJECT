import { useCallback, useState } from 'react'
import { LoginForm } from './LoginForm.web'
import { SignUpForm } from './SignUpForm.web'
import { RecoveryPasswordForm } from './RecoveryPasswordForm.web'
import { useLocale } from '../../i18n/LocaleContext'

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
    <div className="auth-stage app-header min-h-screen flex items-center justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 w-full text-left">
          <div className="relative mb-3 flex min-h-11 items-center">
            <p className="font-display text-xs tracking-[0.22em] uppercase text-muted pr-20">
              {t('header.tagline')}
            </p>
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={
                locale === 'ru' ? t('header.langToEn') : t('header.langToRu')
              }
              title={
                locale === 'ru' ? t('header.langToEn') : t('header.langToRu')
              }
              className="touch-target absolute right-0 top-1/2 z-40 flex h-11 min-w-[4.5rem] -translate-y-1/2 cursor-pointer items-center justify-end gap-1 rounded-xl px-1 font-customMono text-[11px] font-bold tracking-wide text-muted transition-colors hover:text-ink-soft active:bg-[var(--bg-warm)]/60"
            >
              <span
                className={
                  locale === 'ru'
                    ? 'text-ink dark:text-zinc-100'
                    : 'opacity-45'
                }
              >
                RU
              </span>
              <span className="opacity-30" aria-hidden>
                /
              </span>
              <span
                className={
                  locale === 'en'
                    ? 'text-ink dark:text-zinc-100'
                    : 'opacity-45'
                }
              >
                EN
              </span>
            </button>
          </div>
          <h1
            className="flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-none text-ink dark:text-zinc-50"
            aria-label={t('header.titleTodo')}
          >
            <span>{t('header.titleTodo')}</span>
            <img
              src="/logo-mark.png"
              alt=""
              width={56}
              height={56}
              className="h-[1.15em] w-[1.15em] shrink-0 object-contain dark:hidden"
              draggable={false}
            />
            <img
              src="/logo-mark-dark.png"
              alt=""
              width={56}
              height={56}
              className="hidden h-[1.15em] w-[1.15em] shrink-0 object-contain dark:block"
              draggable={false}
            />
          </h1>
          <p className="mt-3 text-sm text-muted max-w-sm">
            {recoveryMode
              ? t('auth.recoveryHint')
              : mode === 'login'
                ? t('auth.loginHint')
                : t('auth.signUpHint')}
          </p>
        </div>

        <div className="space-y-5">
          {!recoveryMode && (
            <div className="flex rounded-xl border border-[var(--border-color)] p-1 bg-[color-mix(in_srgb,var(--bg-warm)_70%,transparent)]">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setInfo(null)
                }}
                className={[
                  'flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                  mode === 'login'
                    ? 'bg-[var(--bg-card)] text-ink dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-muted',
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
                  'flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                  mode === 'signup'
                    ? 'bg-[var(--bg-card)] text-ink dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-muted',
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
