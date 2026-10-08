import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { LoginForm } from './LoginForm.ios'
import { SignUpForm } from './SignUpForm.ios'
import { RecoveryPasswordForm } from './RecoveryPasswordForm.ios'
import { useLocale } from '../../i18n/LocaleContext'
import { mapAuthError } from '../../utils/authErrors'

/**
 * Экран входа/регистрации / сброса пароля.
 * При открытой клавиатуре весь экран можно прокрутить вниз к паролю.
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
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios') return undefined

    let showSub
    let hideSub

    const bind = async () => {
      showSub = await Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardInset(Math.max(0, info.keyboardHeight || 0))
      })
      hideSub = await Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardInset(0)
      })
    }

    void bind()

    return () => {
      void showSub?.remove()
      void hideSub?.remove()
    }
  }, [])

  /** Прокрутить активное поле в видимую зону над клавиатурой. */
  useEffect(() => {
    const onFocusIn = (e) => {
      const el = e.target
      if (!(el instanceof HTMLElement)) return
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return
      window.setTimeout(() => {
        el.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth',
        })
      }, 80)
    }

    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

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
      setError(mapAuthError(result.error, t) || t('auth.resetFailed'))
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

  const hint = recoveryMode
    ? t('auth.recoveryHint')
    : mode === 'login'
      ? t('auth.loginHint')
      : t('auth.signUpHint')

  return (
    <div
      className="auth-stage relative flex flex-col"
      style={{
        ['--keyboard-inset']: `${keyboardInset}px`,
      }}
    >
      <div className="auth-stage-scroll mx-auto flex w-full max-w-md flex-1 flex-col text-center">
        <div className="mt-1.5 mb-2 flex shrink-0 items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-left font-display text-[11px] tracking-[0.2em] uppercase text-muted">
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
            className="touch-target inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-warm)_55%,transparent)] px-3 font-customMono text-[11px] font-bold tracking-wide text-muted transition-colors hover:text-ink-soft active:bg-[var(--bg-warm)]/60"
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

        <header className="mb-5 shrink-0 pt-[5dvh]">
          <h1
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-display text-[2.5rem] font-semibold leading-none tracking-tight text-ink dark:text-zinc-50 sm:text-5xl"
            aria-label={t('header.titleTodo')}
          >
            <span>{t('header.titleTodo')}</span>
            <img
              src="/logo-mark.png"
              alt=""
              width={56}
              height={56}
              className="h-[1.05em] w-[1.05em] shrink-0 object-contain dark:hidden"
              draggable={false}
            />
            <img
              src="/logo-mark-dark.png"
              alt=""
              width={56}
              height={56}
              className="hidden h-[1.05em] w-[1.05em] shrink-0 object-contain dark:block"
              draggable={false}
            />
          </h1>
          <p className="mx-auto mt-3 flex min-h-[2.75rem] max-w-sm items-start justify-center text-[15px] leading-snug text-muted">
            {hint}
          </p>
        </header>

        {!recoveryMode && (
          <div className="mb-4 flex shrink-0 rounded-2xl border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-warm)_70%,transparent)] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
                setInfo(null)
              }}
              className={[
                'min-h-11 flex-1 rounded-xl text-[15px] font-medium transition-colors',
                mode === 'login'
                  ? 'bg-[var(--bg-card)] text-ink shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
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
                'min-h-11 flex-1 rounded-xl text-[15px] font-medium transition-colors',
                mode === 'signup'
                  ? 'bg-[var(--bg-card)] text-ink shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-muted',
              ].join(' ')}
            >
              {t('auth.tabSignUp')}
            </button>
          </div>
        )}

        <div className="mb-2 min-h-[1.25rem] shrink-0" aria-live="polite">
          {info ? (
            <p className="text-sm text-[#3A5F73] dark:text-sky-300" role="status">
              {info}
            </p>
          ) : null}
        </div>

        <div className="auth-form-scroll min-h-0 w-full">
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
