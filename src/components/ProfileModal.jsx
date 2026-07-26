import { useEffect, useState } from 'react'
import { Monitor, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useLocale } from '../i18n/LocaleContext'
import { getDeviceKey } from '../utils/deviceInfo'
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  sanitizeNicknameInput,
  validateNickname,
} from '../utils/nickname'
import { isNicknameAvailable } from '../lib/nicknameAvailability'
import {
  clearLoginFailures,
  getLoginLockStatus,
  isAuthBanError,
  recordLoginFailure,
} from '../utils/loginLockout'

const fieldClass =
  'w-full rounded-xl border border-black/[0.08] dark:border-zinc-700 bg-surface dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-ink dark:text-zinc-50 outline-none focus:ring-2 focus:ring-[#B7D0DE]/40 dark:focus:ring-white/15'

const FORBIDDEN = /[^\p{L}\p{N}_-]/u

function formatDate(value, localeTag) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(localeTag, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Модалка профиля: данные, устройства, смена ника (с паролем), смена пароля по email.
 */
export function ProfileModal({ user, open, onClose, onRequestPasswordReset }) {
  const { t, localeTag } = useLocale()
  const [profile, setProfile] = useState(null)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [resetting, setResetting] = useState(false)

  const [nickDraft, setNickDraft] = useState('')
  const [nickPassword, setNickPassword] = useState('')
  const [forbiddenChars, setForbiddenChars] = useState(false)
  const [savingNick, setSavingNick] = useState(false)

  const currentKey = getDeviceKey()

  useEffect(() => {
    if (!open || !user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setStatus(null)
      setNickPassword('')
      setForbiddenChars(false)

      const [{ data: profileRow }, { data: deviceRows, error: devicesError }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('nickname, email, created_at')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('user_devices')
            .select('*')
            .eq('user_id', user.id)
            .order('last_seen', { ascending: false }),
        ])

      if (cancelled) return

      if (devicesError) {
        setError(devicesError.message)
      }

      const nextProfile =
        profileRow ?? {
          nickname: user.user_metadata?.nickname ?? null,
          email: user.email,
          created_at: user.created_at,
        }

      setProfile(nextProfile)
      setNickDraft(nextProfile.nickname || user.user_metadata?.nickname || '')
      setDevices(deviceRows ?? [])
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, user])

  if (!open) return null

  const nickname =
    profile?.nickname || user.user_metadata?.nickname || '—'
  const email = profile?.email || user.email || '—'

  const handleNicknameInput = (e) => {
    const raw = e.target.value
    if (FORBIDDEN.test(raw)) setForbiddenChars(true)
    setNickDraft(sanitizeNicknameInput(raw))
  }

  const handleChangeNickname = async (e) => {
    e.preventDefault()
    setError(null)
    setStatus(null)

    const nick = nickDraft.trim()
    const nickError = validateNickname(nick)
    if (nickError === 'empty') {
      setError(t('auth.nicknameRequired'))
      return
    }
    if (nickError === 'tooShort') {
      setError(t('auth.nicknameTooShort', { n: NICKNAME_MIN }))
      return
    }
    if (nickError === 'invalidChars') {
      setError(t('auth.nicknameInvalid'))
      setForbiddenChars(true)
      return
    }

    if (!nickPassword) {
      setError(t('profile.passwordRequired'))
      return
    }

    if (!email || email === '—') {
      setError(t('profile.noEmail'))
      return
    }

    if (nick.toLowerCase() === String(nickname).toLowerCase()) {
      setError(t('profile.nicknameUnchanged'))
      return
    }

    setSavingNick(true)

    const loginKey = String(email).trim().toLowerCase()
    const lock = await getLoginLockStatus(loginKey)
    if (lock.locked) {
      setSavingNick(false)
      const sec = lock.retryAfterSeconds || 180
      const m = Math.floor(sec / 60)
      const r = sec % 60
      const time = `${m}:${String(r).padStart(2, '0')}`
      setError(t('auth.loginLocked', { time }))
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginKey,
      password: nickPassword,
    })
    if (authError) {
      setSavingNick(false)
      if (isAuthBanError(authError.message)) {
        setError(t('auth.loginLockedShort'))
        return
      }
      const afterFail = await recordLoginFailure(loginKey)
      if (afterFail.locked) {
        const sec = afterFail.retryAfterSeconds || 180
        const m = Math.floor(sec / 60)
        const r = sec % 60
        const time = `${m}:${String(r).padStart(2, '0')}`
        setError(t('auth.loginLocked', { time }))
        return
      }
      setError(t('profile.wrongPassword'))
      return
    }

    await clearLoginFailures(loginKey)

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .ilike('nickname', nick)
      .maybeSingle()

    if (taken && taken.id !== user.id) {
      setSavingNick(false)
      setError(t('auth.nicknameTaken'))
      return
    }

    const free = await isNicknameAvailable(nick, user.id)
    if (!free) {
      setSavingNick(false)
      setError(t('auth.nicknameTaken'))
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        nickname: nick,
        email: String(email).trim().toLowerCase(),
      })

    if (profileError) {
      setSavingNick(false)
      const takenDb =
        profileError.code === '23505' ||
        /duplicate|unique/i.test(profileError.message)
      setError(takenDb ? t('auth.nicknameTaken') : profileError.message)
      return
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: { nickname: nick },
    })

    setSavingNick(false)

    if (metaError) {
      setError(metaError.message)
      return
    }

    setProfile((prev) => ({ ...(prev || {}), nickname: nick }))
    setNickPassword('')
    setStatus(t('profile.nicknameUpdated'))
  }

  const handleResetPassword = async () => {
    setResetting(true)
    setError(null)
    setStatus(null)
    const result = await onRequestPasswordReset(email)
    setResetting(false)
    if (!result?.ok) {
      setError(
        result?.error === 'email_rate_limit'
          ? t('auth.emailRateLimit')
          : result?.error || t('auth.resetFailed'),
      )
      return
    }
    setStatus(t('auth.resetEmailSent'))
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.title')}
    >
      <div className="w-full max-w-md ui-card dark:bg-zinc-900 dark:border-zinc-700 p-5 sm:p-6 space-y-5 animate-slide-up max-h-[min(90vh,640px)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
              {t('profile.title')}
            </p>
            <h2 className="font-display text-xl font-semibold text-ink dark:text-zinc-50 mt-0.5">
              {nickname}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('profile.close')}
            className="p-2 rounded-xl text-muted hover:bg-canvas-warm dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
            {t('profile.account')}
          </h3>
          <dl className="rounded-xl border border-black/[0.06] dark:border-zinc-700 bg-canvas-warm/50 dark:bg-zinc-950/50 px-3.5 py-3 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted dark:text-zinc-400">{t('auth.email')}</dt>
              <dd className="text-ink dark:text-zinc-100 font-medium truncate">
                {email}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted dark:text-zinc-400">
                {t('profile.createdAt')}
              </dt>
              <dd className="text-ink dark:text-zinc-100 tabular-nums">
                {formatDate(profile?.created_at || user.created_at, localeTag)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted dark:text-zinc-400">
                {t('profile.lastSignIn')}
              </dt>
              <dd className="text-ink dark:text-zinc-100 tabular-nums">
                {formatDate(user.last_sign_in_at, localeTag)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
            {t('profile.changeNickname')}
          </h3>
          <form
            onSubmit={(e) => void handleChangeNickname(e)}
            className="rounded-xl border border-black/[0.06] dark:border-zinc-700 bg-canvas-warm/40 dark:bg-zinc-950/40 p-3 space-y-2.5"
          >
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
                {t('auth.nickname')}
              </span>
              <input
                type="text"
                value={nickDraft}
                onChange={handleNicknameInput}
                maxLength={NICKNAME_MAX}
                minLength={NICKNAME_MIN}
                className={fieldClass}
                autoComplete="username"
                spellCheck={false}
              />
              {forbiddenChars && (
                <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
                  {t('auth.nicknameForbiddenTyped')}
                </p>
              )}
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
                {t('profile.confirmWithPassword')}
              </span>
              <input
                type="password"
                value={nickPassword}
                onChange={(e) => setNickPassword(e.target.value)}
                className={fieldClass}
                autoComplete="current-password"
                placeholder={t('profile.passwordPlaceholder')}
              />
            </label>
            <button
              type="submit"
              disabled={savingNick || loading}
              className="w-full rounded-xl bg-ink dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {savingNick ? t('auth.loading') : t('profile.saveNickname')}
            </button>
          </form>
          {status && (
            <p className="text-sm text-[#3A5F73] dark:text-sky-300" role="status">
              {status}
            </p>
          )}
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
            {t('profile.devices')}
          </h3>
          {loading ? (
            <p className="text-sm text-muted dark:text-zinc-400">
              {t('auth.loading')}
            </p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted dark:text-zinc-400">
              {t('profile.noDevices')}
            </p>
          ) : (
            <ul className="space-y-2">
              {devices.map((device) => {
                const isCurrent = device.device_key === currentKey
                return (
                  <li
                    key={device.id}
                    className="flex items-start gap-3 rounded-xl border border-black/[0.06] dark:border-zinc-700 px-3 py-2.5"
                  >
                    <Monitor
                      size={18}
                      className="mt-0.5 shrink-0 text-muted dark:text-zinc-400"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink dark:text-zinc-100 truncate">
                        {device.label}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-[#3A5F73] dark:text-sky-300">
                            {t('profile.thisDevice')}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted dark:text-zinc-400 mt-0.5">
                        {t('profile.lastSeen')}:{' '}
                        {formatDate(device.last_seen, localeTag)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2 pt-1">
          <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
            {t('profile.security')}
          </h3>
          <p className="text-xs text-muted dark:text-zinc-400">
            {t('profile.changePasswordHint')}
          </p>
          <button
            type="button"
            disabled={resetting || !email || email === '—'}
            onClick={() => void handleResetPassword()}
            className="w-full rounded-xl border border-black/[0.08] dark:border-zinc-600 bg-surface dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-ink dark:text-zinc-100 hover:bg-canvas-warm dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            {resetting ? t('auth.loading') : t('profile.changePassword')}
          </button>
          {(status || error) && (
            <div className="space-y-1">
              {status && (
                <p className="text-sm text-[#3A5F73] dark:text-sky-300" role="status">
                  {status}
                </p>
              )}
              {error && (
                <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
