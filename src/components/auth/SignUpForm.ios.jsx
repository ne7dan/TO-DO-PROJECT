import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  generateNicknameVariants,
  sanitizeNicknameInput,
  suggestNicknamesFromEmail,
  validateNickname,
} from '../../utils/nickname'
import {
  filterAvailableNicknames,
  isNicknameAvailable,
} from '../../lib/nicknameAvailability'
import { validateSignUpPassword } from '../../utils/passwordValidation'
import { validateEmail } from '../../utils/emailValidation'

const fieldClass =
  'w-full box-border rounded-2xl border border-black/[0.08] dark:border-zinc-700 bg-surface dark:bg-zinc-950 px-4 py-3.5 text-left text-[16px] leading-snug text-ink dark:text-zinc-50 outline-none transition-[border-color,box-shadow] focus:border-[var(--accent-color)] focus:shadow-[0_0_0_3px_var(--accent-glow)]'

const labelClass =
  'block text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted dark:text-zinc-400'

const fieldErrorRing =
  'border-rose-400/70 shadow-[0_0_0_3px_rgba(251,113,133,0.25)] focus:border-rose-400/70 focus:shadow-[0_0_0_3px_rgba(251,113,133,0.25)]'
const fieldOkRing =
  'border-emerald-500/50 shadow-[0_0_0_3px_rgba(16,185,129,0.2)] focus:border-emerald-500/50 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.2)]'

const FORBIDDEN = /[^\p{L}\p{N}_-]/u

/** Задержка live-проверки ника (меньше запросов к Supabase). */
const NICK_CHECK_DEBOUNCE_MS = 350

function mapAuthError(error, t) {
  if (!error) return null
  if (error === 'nickname_taken') return t('auth.nicknameTaken')
  return error
}

function nickFormatMessage(nickError, t) {
  if (nickError === 'empty') return null
  if (nickError === 'tooShort') return t('auth.nicknameTooShort', { n: NICKNAME_MIN })
  if (nickError === 'invalidChars') return t('auth.nicknameInvalid')
  return null
}

/**
 * Форма регистрации: email → свободные подсказки ника → свой ник → пароли.
 * Все поля валидируются в live-режиме при вводе.
 */
export function SignUpForm({ onSubmit, loading, error }) {
  const { t } = useLocale()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState(null)
  const [forbiddenChars, setForbiddenChars] = useState(false)
  const [pickedSuggestion, setPickedSuggestion] = useState(null)
  const [nickTouched, setNickTouched] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  /** idle | checking | available | taken */
  const [nickAvailability, setNickAvailability] = useState('idle')

  // —— Live-валидация (без ожидания submit) ——
  const emailErrorKey = useMemo(() => {
    if (!email.trim()) return null
    return validateEmail(email)
  }, [email])

  const emailError = emailErrorKey ? t(emailErrorKey) : null
  const emailOk = Boolean(email.trim()) && !emailErrorKey

  const nickFormatError = useMemo(() => {
    if (!nickname.trim()) return null
    return nickFormatMessage(validateNickname(nickname), t)
  }, [nickname, t])

  const passwordErrorKey = useMemo(() => {
    if (!password) return null
    return validateSignUpPassword(password)
  }, [password])

  const passwordError = passwordErrorKey ? t(passwordErrorKey) : null
  const passwordOk = Boolean(password) && !passwordErrorKey

  const confirmError = useMemo(() => {
    if (!confirm) return null
    if (confirm !== password) return t('auth.passwordMismatch')
    if (passwordErrorKey) return null
    return null
  }, [confirm, password, passwordErrorKey, t])

  const confirmOk =
    Boolean(confirm) && !confirmError && passwordOk && confirm === password

  const nickTaken = nickAvailability === 'taken'
  const nickOk = nickAvailability === 'available' && !nickFormatError

  const formValid =
    emailOk &&
    nickOk &&
    passwordOk &&
    confirmOk &&
    !forbiddenChars

  const rawSuggestions = useMemo(
    () => suggestNicknamesFromEmail(emailOk ? email : ''),
    [email, emailOk],
  )

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      if (rawSuggestions.length === 0) {
        if (!cancelled) setSuggestions([])
        return
      }
      const extras = generateNicknameVariants(rawSuggestions[0], 10).filter(
        (n) => !rawSuggestions.includes(n),
      )
      const free = await filterAvailableNicknames([
        ...rawSuggestions,
        ...extras,
      ])
      if (cancelled) return
      const top = free.slice(0, 3)
      setSuggestions(top)

      if (!nickTouched && top.length > 0) {
        setNickname(top[0])
        setPickedSuggestion(top[0])
      }
      if (!nickTouched && top.length === 0) {
        setNickname('')
        setPickedSuggestion(null)
      }
    }

    void refresh()
    return () => {
      cancelled = true
    }
  }, [rawSuggestions, nickTouched])

  // Live-проверка занятости ника (debounce)
  useEffect(() => {
    const nick = nickname.trim()
    const formatError = validateNickname(nick)

    if (formatError) {
      setNickAvailability('idle')
      return undefined
    }

    setNickAvailability('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      const free = await isNicknameAvailable(nick)
      if (cancelled) return
      setNickAvailability(free ? 'available' : 'taken')
    }, NICK_CHECK_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [nickname])

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    setLocalError(null)
  }

  const handleNicknameChange = (e) => {
    const raw = e.target.value
    if (FORBIDDEN.test(raw)) {
      setForbiddenChars(true)
    }
    setNickTouched(true)
    setLocalError(null)
    const next = sanitizeNicknameInput(raw)
    setNickname(next)
    setPickedSuggestion(suggestions.includes(next) ? next : null)
  }

  const pickSuggestion = (value) => {
    setNickname(value)
    setPickedSuggestion(value)
    setNickTouched(false)
    setForbiddenChars(false)
    setLocalError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    const emailKey = validateEmail(email)
    if (emailKey) return

    const nickError = validateNickname(nickname)
    if (nickError) return

    if (nickAvailability === 'taken' || nickAvailability === 'checking') return

    const pwdErrorKey = validateSignUpPassword(password)
    if (pwdErrorKey) return

    if (password !== confirm) return

    const free = await isNicknameAvailable(nickname.trim())
    if (!free) {
      setNickAvailability('taken')
      return
    }

    await onSubmit(email.trim().toLowerCase(), password, nickname.trim())
  }

  const displayError = localError || mapAuthError(error, t)
  const submitDisabled = loading || !formValid || nickAvailability === 'checking'

  const showFormError =
    displayError &&
    !(nickTaken && displayError === t('auth.nicknameTaken'))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <label className="block space-y-1.5">
        <span className={labelClass}>{t('auth.email')}</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={handleEmailChange}
          className={[
            fieldClass,
            emailError ? fieldErrorRing : emailOk ? fieldOkRing : '',
          ]
            .filter(Boolean)
            .join(' ')}
          placeholder="you@example.com"
          aria-invalid={Boolean(emailError)}
        />
        {emailError && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {emailError}
          </p>
        )}
      </label>

      <div className="space-y-1.5">
        <span className={labelClass}>{t('auth.nickname')}</span>

        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted dark:text-zinc-500">
              {t('auth.nicknameSuggestions')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((option) => {
                const active =
                  pickedSuggestion === option && nickname === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => pickSuggestion(option)}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'border-[var(--accent-color)] bg-[var(--accent-soft)] text-[var(--text-main)]'
                        : 'border-black/[0.08] dark:border-zinc-700 bg-surface dark:bg-zinc-900 text-ink-soft dark:text-zinc-200 hover:bg-canvas-warm dark:hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted dark:text-zinc-500">
              {t('auth.nicknameOrCustom')}
            </p>
          </div>
        )}

        <input
          type="text"
          name="nickname"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          minLength={NICKNAME_MIN}
          maxLength={NICKNAME_MAX}
          value={nickname}
          onChange={handleNicknameChange}
          className={[
            fieldClass,
            nickTaken || nickFormatError
              ? fieldErrorRing
              : nickOk
                ? fieldOkRing
                : '',
          ]
            .filter(Boolean)
            .join(' ')}
          placeholder={t('auth.nicknamePlaceholder')}
          spellCheck={false}
          aria-invalid={nickTaken || Boolean(nickFormatError)}
        />
        {forbiddenChars && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {t('auth.nicknameForbiddenTyped')}
          </p>
        )}
        {!forbiddenChars && nickFormatError && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {nickFormatError}
          </p>
        )}
        {!forbiddenChars &&
          !nickFormatError &&
          nickAvailability === 'checking' && (
            <p className="text-sm text-muted dark:text-zinc-400" role="status">
              {t('auth.nicknameChecking')}
            </p>
          )}
        {!forbiddenChars && !nickFormatError && nickTaken && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {t('auth.nicknameTaken')}
          </p>
        )}
        {!forbiddenChars && !nickFormatError && nickOk && (
          <p
            className="text-sm text-emerald-700 dark:text-emerald-400"
            role="status"
          >
            {t('auth.nicknameAvailable')}
          </p>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>{t('auth.password')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setLocalError(null)
          }}
          className={[
            fieldClass,
            passwordError ? fieldErrorRing : passwordOk ? fieldOkRing : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(passwordError)}
        />
        {passwordError && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {passwordError}
          </p>
        )}
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>{t('auth.confirmPassword')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setLocalError(null)
          }}
          className={[
            fieldClass,
            confirmError ? fieldErrorRing : confirmOk ? fieldOkRing : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(confirmError)}
        />
        {confirmError && (
          <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
            {confirmError}
          </p>
        )}
      </label>

      {showFormError && (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        className="auth-submit mt-1 w-full rounded-2xl bg-ink text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? t('auth.loading') : t('auth.signUp')}
      </button>
    </form>
  )
}
