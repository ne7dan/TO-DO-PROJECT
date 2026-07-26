import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'

const fieldClass =
  'w-full rounded-xl border border-black/[0.08] dark:border-zinc-700 bg-surface dark:bg-zinc-950 px-4 py-3 text-[15px] text-ink dark:text-zinc-50 outline-none focus:ring-2 focus:ring-[#B7D0DE]/40 dark:focus:ring-white/15 disabled:opacity-50 disabled:cursor-not-allowed'

function mapAuthError(error, t, remainingLabel) {
  if (!error) return null
  if (error === 'nickname_not_found') return t('auth.nicknameNotFound')
  if (error === 'empty_login') return t('auth.loginRequired')
  if (error === 'nickname_taken') return t('auth.nicknameTaken')
  if (error === 'login_locked') {
    return remainingLabel
      ? t('auth.loginLocked', { time: remainingLabel })
      : t('auth.loginLockedShort')
  }
  return error
}

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
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <div className="rounded-xl border border-black/[0.06] dark:border-zinc-700/80 bg-canvas-warm/40 dark:bg-zinc-950/40 p-3.5 space-y-3 mb-5">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
            {t('auth.loginId')}
          </span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={fieldClass}
            placeholder={t('auth.loginIdPlaceholder')}
            spellCheck={false}
            disabled={locked || loading}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
            {t('auth.password')}
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            disabled={locked || loading}
          />
          <a
            href="#forgot-password"
            className={[
              'inline-block text-[12px] text-[#3A5F73] dark:text-sky-300 underline-offset-2',
              locked
                ? 'pointer-events-none opacity-40'
                : 'hover:underline',
            ].join(' ')}
            onClick={(e) => {
              e.preventDefault()
              if (locked) return
              onForgotPassword?.(identifier)
            }}
            aria-disabled={locked}
          >
            {t('auth.forgotPassword')}
          </a>
        </label>
      </div>

      {displayError && (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || locked}
        className="w-full rounded-xl bg-ink dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
