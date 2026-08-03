import { useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'

const fieldClass =
  'w-full rounded-2xl border border-black/[0.08] dark:border-zinc-700 bg-surface dark:bg-zinc-950 px-4 py-3.5 text-left text-[16px] leading-snug text-ink dark:text-zinc-50 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent-color)] focus:shadow-[0_0_0_3px_var(--accent-glow)]'

const labelClass =
  'block text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted dark:text-zinc-400'

/**
 * Задать новый пароль после перехода по ссылке из письма.
 */
export function RecoveryPasswordForm({ onSubmit, onCancel, loading }) {
  const { t } = useLocale()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    const result = await onSubmit(password)
    if (!result?.ok) setError(result?.error || t('auth.resetFailed'))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-[15px] text-muted dark:text-zinc-400">
        {t('auth.recoveryHint')}
      </p>
      <label className="block space-y-1.5">
        <span className={labelClass}>{t('auth.newPassword')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block space-y-1.5">
        <span className={labelClass}>{t('auth.confirmPassword')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={fieldClass}
        />
      </label>
      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="auth-submit mt-1 w-full rounded-2xl bg-ink text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? t('auth.loading') : t('auth.savePassword')}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 w-full text-[15px] text-muted transition-colors hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {t('auth.cancel')}
        </button>
      )}
    </form>
  )
}
