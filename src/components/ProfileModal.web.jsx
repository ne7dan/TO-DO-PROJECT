import { useEffect, useState } from 'react'
import { Check, Monitor, Moon, Sun, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useLocale } from '../i18n/LocaleContext'
import { getDeviceKey, dedupeDevicesByLabel } from '../utils/deviceInfo'
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
import { ACCENTS, BG_THEMES } from '../utils/appearance'

const fieldClass =
  'w-full rounded-xl border border-[var(--border-color)] bg-surface dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-ink dark:text-zinc-50 outline-none focus:ring-2 focus:ring-[var(--accent-glow)]'

const FORBIDDEN = /[^\p{L}\p{N}_-]/u

const segmentWrap =
  'flex rounded-xl border border-[var(--border-color)] p-1 bg-[color-mix(in_srgb,var(--bg-warm)_70%,transparent)]'

function formatDate(value, localeTag) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(localeTag, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function SegmentButton({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--bg-card)] text-ink shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
          : 'text-muted hover:text-ink-soft',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/**
 * Модалка профиля: аккаунт + отдельная вкладка оформления.
 */
export function ProfileModal({
  user,
  open,
  onClose,
  onRequestPasswordReset,
  isDark,
  onModeChange,
  bgTheme,
  accent,
  onBgThemeChange,
  onAccentChange,
}) {
  const { locale, t, localeTag, setLocale } = useLocale()
  const [tab, setTab] = useState('account')
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
  const showAppearance =
    typeof onModeChange === 'function' ||
    typeof onBgThemeChange === 'function' ||
    typeof onAccentChange === 'function'

  useEffect(() => {
    if (!open) return
    setTab('account')
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const scrollY = window.scrollY
    const body = document.body
    const html = document.documentElement
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    }
    const gutter = Math.max(0, window.innerWidth - html.clientWidth)

    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    if (gutter > 0) body.style.paddingRight = `${gutter}px`
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      body.style.overflow = prev.bodyOverflow
      body.style.position = prev.bodyPosition
      body.style.top = prev.bodyTop
      body.style.width = prev.bodyWidth
      body.style.paddingRight = prev.bodyPaddingRight
      html.style.overflow = prev.htmlOverflow
      html.style.overscrollBehavior = prev.htmlOverscroll
      window.scrollTo(0, scrollY)
    }
  }, [open])

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
      setDevices(dedupeDevicesByLabel(deviceRows ?? [], currentKey))
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, user, currentKey])

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
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.title')}
      onWheel={(e) => {
        if (e.target === e.currentTarget) e.preventDefault()
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault()
      }}
    >
      <div className="w-full max-w-md ui-card p-5 sm:p-6 animate-slide-up max-h-[min(90vh,640px)] flex flex-col overflow-hidden overscroll-contain">
        <div className="flex items-start justify-between gap-3 shrink-0">
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
            className="btn-danger-hover p-2 rounded-xl text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {showAppearance && (
          <div className={`${segmentWrap} mt-5 shrink-0`} role="tablist">
            <SegmentButton
              active={tab === 'account'}
              onClick={() => setTab('account')}
            >
              {t('profile.account')}
            </SegmentButton>
            <SegmentButton
              active={tab === 'appearance'}
              onClick={() => setTab('appearance')}
            >
              {t('profile.appearance')}
            </SegmentButton>
          </div>
        )}

        <div className="mt-5 space-y-5 ui-scroll overflow-y-auto overscroll-y-contain min-h-0 pr-1 touch-pan-y">
          {tab === 'account' || !showAppearance ? (
            <>
              <section className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted dark:text-zinc-400">
                  {t('profile.account')}
                </h3>
                <dl className="rounded-xl border border-[var(--border-color)] bg-canvas-warm/50 dark:bg-zinc-950/50 px-3.5 py-3 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted dark:text-zinc-400">
                      {t('auth.email')}
                    </dt>
                    <dd className="text-ink dark:text-zinc-100 font-medium truncate">
                      {email}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted dark:text-zinc-400">
                      {t('profile.createdAt')}
                    </dt>
                    <dd className="text-ink dark:text-zinc-100 tabular-nums">
                      {formatDate(
                        profile?.created_at || user.created_at,
                        localeTag,
                      )}
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
                  className="rounded-xl border border-[var(--border-color)] bg-canvas-warm/40 dark:bg-zinc-950/40 p-3 space-y-2.5"
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
                      <p
                        className="text-sm text-rose-600 dark:text-rose-400"
                        role="alert"
                      >
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
                  <p
                    className="text-sm text-[#3A5F73] dark:text-sky-300"
                    role="status"
                  >
                    {status}
                  </p>
                )}
                {error && (
                  <p
                    className="text-sm text-rose-600 dark:text-rose-400"
                    role="alert"
                  >
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
                          className="flex items-start gap-3 rounded-xl border border-[var(--border-color)] px-3 py-2.5"
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

              <section className="space-y-2 pt-1 pb-1">
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
                  className="w-full rounded-xl border border-[var(--border-color)] bg-surface dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-ink dark:text-zinc-100 hover:bg-canvas-warm dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  {resetting ? t('auth.loading') : t('profile.changePassword')}
                </button>
                {(status || error) && (
                  <div className="space-y-1">
                    {status && (
                      <p
                        className="text-sm text-[#3A5F73] dark:text-sky-300"
                        role="status"
                      >
                        {status}
                      </p>
                    )}
                    {error && (
                      <p
                        className="text-sm text-rose-600 dark:text-rose-400"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="space-y-5 pb-1 animate-fade-in">
              <section className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  {t('profile.language')}
                </h3>
                <div className={segmentWrap}>
                  <SegmentButton
                    active={locale === 'ru'}
                    onClick={() => setLocale('ru')}
                  >
                    {t('profile.lang.ru')}
                  </SegmentButton>
                  <SegmentButton
                    active={locale === 'en'}
                    onClick={() => setLocale('en')}
                  >
                    {t('profile.lang.en')}
                  </SegmentButton>
                </div>
              </section>

              {typeof onModeChange === 'function' && (
                <section className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    {t('profile.mode')}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onModeChange('light')}
                      aria-pressed={!isDark}
                      className={[
                        'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors',
                        !isDark
                          ? 'border-[color-mix(in_srgb,var(--accent-color)_55%,var(--border-color))] bg-[var(--accent-soft)] text-ink'
                          : 'border-[var(--border-color)] text-muted hover:bg-[var(--bg-warm)]',
                      ].join(' ')}
                    >
                      <Sun size={18} strokeWidth={1.75} className="shrink-0" />
                      <span className="text-sm font-medium">
                        {t('profile.mode.light')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onModeChange('dark')}
                      aria-pressed={isDark}
                      className={[
                        'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors',
                        isDark
                          ? 'border-[color-mix(in_srgb,var(--accent-color)_55%,var(--border-color))] bg-[var(--accent-soft)] text-ink'
                          : 'border-[var(--border-color)] text-muted hover:bg-[var(--bg-warm)]',
                      ].join(' ')}
                    >
                      <Moon size={18} strokeWidth={1.75} className="shrink-0" />
                      <span className="text-sm font-medium">
                        {t('profile.mode.dark')}
                      </span>
                    </button>
                  </div>
                </section>
              )}

              {typeof onBgThemeChange === 'function' && (
                <section className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    {t('appearance.theme')}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {BG_THEMES.map((theme) => {
                      const active = bgTheme === theme.id
                      const swatch = isDark
                        ? theme.swatchDark
                        : theme.swatchLight
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => onBgThemeChange(theme.id)}
                          aria-pressed={active}
                          className={[
                            'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                            active
                              ? 'border-[color-mix(in_srgb,var(--accent-color)_55%,var(--border-color))] bg-[var(--accent-soft)]'
                              : 'border-[var(--border-color)] hover:bg-[var(--bg-warm)]',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
                              active
                                ? 'border-[var(--accent-color)]'
                                : 'border-black/10 dark:border-white/20',
                            ].join(' ')}
                            style={{ backgroundColor: swatch }}
                            aria-hidden
                          >
                            {active && (
                              <Check
                                size={14}
                                strokeWidth={2.5}
                                className={
                                  isDark
                                    ? 'text-white drop-shadow'
                                    : 'text-zinc-800 drop-shadow-sm'
                                }
                              />
                            )}
                          </span>
                          <span
                            className={[
                              'text-sm font-medium leading-snug',
                              active ? 'text-ink' : 'text-muted',
                            ].join(' ')}
                          >
                            {t(`appearance.theme.${theme.id}`)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {typeof onAccentChange === 'function' && (
                <section className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    {t('appearance.accent')}
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {ACCENTS.map((item) => {
                      const active = accent === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onAccentChange(item.id)}
                          aria-label={t(`appearance.accent.${item.id}`)}
                          title={t(`appearance.accent.${item.id}`)}
                          aria-pressed={active}
                          className={[
                            'accent-swatch touch-target mx-auto h-11 w-11 cursor-pointer rounded-full border-2 transition-transform duration-150',
                            active
                              ? 'scale-110 border-white/80'
                              : 'border-transparent opacity-90 hover:opacity-100',
                          ].join(' ')}
                          style={{
                            backgroundColor: item.swatch,
                            boxShadow: active
                              ? `0 0 0 3px color-mix(in srgb, ${item.swatch} 45%, transparent)`
                              : undefined,
                          }}
                        />
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
