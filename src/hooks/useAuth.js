import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getDeviceKey, getDeviceLabel } from '../utils/deviceInfo'
import {
  clearLoginFailures,
  getLoginLockStatus,
  isAuthBanError,
  recordLoginFailure,
} from '../utils/loginLockout'

function looksLikeEmail(value) {
  return String(value).includes('@')
}

async function touchCurrentDevice(userId) {
  if (!userId) return
  const device_key = getDeviceKey()
  const user_agent =
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const label = getDeviceLabel(user_agent)
  const last_seen = new Date().toISOString()

  // Одна запись на label: обновляем свежую, лишние с тем же label удаляем
  const { data: sameLabel, error: listError } = await supabase
    .from('user_devices')
    .select('id, device_key, last_seen')
    .eq('user_id', userId)
    .eq('label', label)
    .order('last_seen', { ascending: false })

  if (listError) {
    console.error('[auth] device list', listError.message)
    return
  }

  const rows = sameLabel ?? []
  const keep =
    rows.find((r) => r.device_key === device_key) ?? rows[0] ?? null

  if (keep?.id) {
    const { error: updError } = await supabase
      .from('user_devices')
      .update({ device_key, user_agent, last_seen, label })
      .eq('id', keep.id)
      .eq('user_id', userId)
    if (updError) console.error('[auth] device update', updError.message)

    const removeIds = rows.filter((r) => r.id !== keep.id).map((r) => r.id)
    if (removeIds.length > 0) {
      const { error: delError } = await supabase
        .from('user_devices')
        .delete()
        .eq('user_id', userId)
        .in('id', removeIds)
      if (delError) console.error('[auth] device dedupe', delError.message)
    }
    return
  }

  const { error } = await supabase.from('user_devices').upsert(
    {
      user_id: userId,
      device_key,
      label,
      user_agent,
      last_seen,
    },
    { onConflict: 'user_id,device_key' },
  )
  if (error) console.error('[auth] device upsert', error.message)
}

/**
 * Следит за сессией Supabase Auth.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session ?? null)
      setLoading(false)
      if (data.session?.user?.id) {
        void touchCurrentDevice(data.session.user.id)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      setError(null)
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      }
      if (event === 'SIGNED_IN' && nextSession?.user?.id) {
        void touchCurrentDevice(nextSession.user.id)
      }
      if (event === 'SIGNED_OUT') {
        setRecoveryMode(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email, password, nickname = '') => {
    setError(null)
    const nick = String(nickname ?? '').trim()
    const mail = email.trim().toLowerCase()

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('nickname', nick)
      .maybeSingle()

    if (existing) {
      const msg = 'nickname_taken'
      setError(msg)
      return { ok: false, error: msg }
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: mail,
      password,
      options: {
        data: { nickname: nick },
      },
    })
    if (signUpError) {
      const msg = /duplicate|unique|already/i.test(signUpError.message)
        ? 'nickname_taken'
        : signUpError.message
      setError(msg)
      return { ok: false, error: msg }
    }

    const userId = data.user?.id
    if (userId && data.session) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        nickname: nick,
        email: mail,
      })
      if (profileError) {
        const taken =
          profileError.code === '23505' ||
          /duplicate|unique/i.test(profileError.message)
        if (taken) {
          setError('nickname_taken')
          return { ok: false, error: 'nickname_taken' }
        }
        console.error('[auth] profiles upsert', profileError.message)
      }
      void touchCurrentDevice(userId)
    }

    return { ok: true, data }
  }, [])

  const signIn = useCallback(async (identifier, password) => {
    setError(null)
    const raw = String(identifier ?? '').trim()
    if (!raw) {
      setError('empty_login')
      return { ok: false, error: 'empty_login' }
    }

    let email = raw
    if (!looksLikeEmail(raw)) {
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('email')
        .ilike('nickname', raw)
        .maybeSingle()

      if (lookupError) {
        setError(lookupError.message)
        return { ok: false, error: lookupError.message }
      }
      if (!profile?.email) {
        setError('nickname_not_found')
        return { ok: false, error: 'nickname_not_found' }
      }
      email = profile.email
    }

    const loginKey = email.trim().toLowerCase()
    const lock = await getLoginLockStatus(loginKey)
    if (lock.locked) {
      const err = 'login_locked'
      setError(err)
      return {
        ok: false,
        error: err,
        lockedUntil: lock.lockedUntil,
        retryAfterSeconds: lock.retryAfterSeconds,
      }
    }

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: loginKey,
        password,
      })

    if (signInError) {
      if (isAuthBanError(signInError.message)) {
        const banLock = await getLoginLockStatus(loginKey)
        const err = 'login_locked'
        setError(err)
        return {
          ok: false,
          error: err,
          lockedUntil: banLock.lockedUntil,
          retryAfterSeconds: banLock.retryAfterSeconds || 180,
        }
      }

      const afterFail = await recordLoginFailure(loginKey)
      if (afterFail.locked) {
        const err = 'login_locked'
        setError(err)
        return {
          ok: false,
          error: err,
          lockedUntil: afterFail.lockedUntil,
          retryAfterSeconds: afterFail.retryAfterSeconds,
        }
      }

      setError(signInError.message)
      return { ok: false, error: signInError.message }
    }

    await clearLoginFailures(loginKey)
    return { ok: true, data }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError(signOutError.message)
      return { ok: false, error: signOutError.message }
    }
    setRecoveryMode(false)
    return { ok: true }
  }, [])

  /** Письмо со ссылкой сброса пароля (forgot + смена из профиля). */
  const requestPasswordReset = useCallback(async (emailOrIdentifier) => {
    setError(null)
    let email = String(emailOrIdentifier ?? '').trim()
    if (!email) {
      return { ok: false, error: 'empty_login' }
    }

    if (!looksLikeEmail(email)) {
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('email')
        .ilike('nickname', email)
        .maybeSingle()
      if (lookupError) return { ok: false, error: lookupError.message }
      if (!profile?.email) return { ok: false, error: 'nickname_not_found' }
      email = profile.email
    }

    const redirectTo = `${window.location.origin}/`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    )
    if (resetError) {
      const msg = /rate.?limit|email rate/i.test(resetError.message)
        ? 'email_rate_limit'
        : resetError.message
      setError(msg)
      return { ok: false, error: msg }
    }
    return { ok: true }
  }, [])

  /** Новый пароль после перехода по ссылке из письма. */
  const updatePassword = useCallback(async (password) => {
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      return { ok: false, error: updateError.message }
    }
    setRecoveryMode(false)
    return { ok: true }
  }, [])

  const clearRecoveryMode = useCallback(() => setRecoveryMode(false), [])

  return {
    session,
    user: session?.user ?? null,
    loading,
    error,
    recoveryMode,
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    clearRecoveryMode,
  }
}
