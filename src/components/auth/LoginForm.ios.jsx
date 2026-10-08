import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleContext'
import { mapAuthError } from '../../utils/authErrors'

const fieldClass =
  'w-full box-border rounded-2xl border border-black/[0.08] dark:border-zinc-700 bg-surface dark:bg-zinc-950 px-4 py-3.5 text-left text-[16px] leading-snug text-ink dark:text-zinc-50 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent-color)] focus:shadow-[0_0_0_3px_var(--accent-glow)] disabled:opacity-50 disabled:cursor-not-allowed'

const labelClass =
  'block text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted dark:text-zinc-400'

function formatRemaining(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/**
 * Форма входа: email или никнейм + пароль + «Забыли пароль?».
 * При серверной блокировке инпуты disabled на время лока.
 */
export function LoginForm({
  onSubmit,
  onForgotPassword,
  loading,
  error,
  lockedUntil,
  onLockExpired,
}) {
  const { t } = useLocale()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remainingSec, setRemainingSec] = useState(0)

  useEffect(() => {
    if (!lockedUntil) {
      setRemainingSec(0)
      return undefined
    }

    const tick = () => {
      const end = new Date(lockedUntil).getTime()
      if (Number.isNaN(end)) {
        setRemainingSec(0)
        return false
      }
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setRemainingSec(left)
      if (left <= 0) {
        onLockExpired?.()
        return false
      }
      return true
    }

    if (!tick()) return undefined
    const id = setInterval(() => {
      if (!tick()) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [lockedUntil, onLockExpired])

  const locked = remainingSec > 0
  const remainingLabel = locked ? formatRemaining(remainingSec) : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (locked || loading) return
    await onSubmit(identifier, password)
  }

  const displayError = mapAuthError(error, t, remainingLabel)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className={labelClass}>{t('auth.loginId')}</span>
        <input
          type="text"
          name="username"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className={fieldClass}
          placeholder={t('auth.loginIdPlaceholder')}
          spellCheck={false}
          disabled={locked || loading}
        />
      </label>

      <div className="space-y-1.5">
        <label className="block space-y-1.5">
          <span className={labelClass}>{t('auth.password')}</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${fieldClass} pr-12`}
              disabled={locked || loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={locked || loading}
              className="touch-target absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-xl text-muted transition-colors hover:text-ink dark:hover:text-zinc-200 disabled:opacity-40"
              aria-label={
                showPassword ? t('auth.hidePassword') : t('auth.showPassword')
              }
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Eye className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </label>

          <button
            type="button"
            disabled={locked || loading}
            className="mx-auto flex min-h-10 items-center justify-center px-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40 dark:hover:text-zinc-200"
            onClick={() => onForgotPassword?.(identifier)}
          >
          {t('auth.forgotPassword')}
        </button>
      </div>

      {displayError && (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || locked}
        className="auth-submit mt-1 w-full rounded-2xl bg-ink text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {locked
          ? t('auth.loginLockedButton', { time: remainingLabel })
          : loading
            ? t('auth.loading')
            : t('auth.signIn')}
      </button>
    </form>
  )
}
