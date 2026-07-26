import { useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'

const fieldClass =
  'w-full rounded-xl border border-black/[0.08] dark:border-zinc-700 bg-surface dark:bg-zinc-950 px-4 py-3 text-[15px] text-ink dark:text-zinc-50 outline-none focus:ring-2 focus:ring-[#B7D0DE]/40 dark:focus:ring-white/15'

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
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-muted dark:text-zinc-400">
        {t('auth.recoveryHint')}
      </p>
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
          {t('auth.newPassword')}
        </span>
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
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
          {t('auth.confirmPassword')}
        </span>
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
        className="w-full rounded-xl bg-ink dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {loading ? t('auth.loading') : t('auth.savePassword')}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-sm text-muted dark:text-zinc-400 hover:text-ink dark:hover:text-zinc-200"
        >
          {t('auth.cancel')}
        </button>
      )}
    </form>
  )
}
