import { supabase } from '../supabaseClient'

function normalizeLockStatus(data) {
  if (!data || typeof data !== 'object') {
    return {
      locked: false,
      failedCount: 0,
      retryAfterSeconds: 0,
      lockedUntil: null,
    }
  }
  return {
    locked: Boolean(data.locked),
    failedCount: Number(data.failed_count) || 0,
    retryAfterSeconds: Number(data.retry_after_seconds) || 0,
    lockedUntil: data.locked_until ?? null,
  }
}

/**
 * Статус блокировки входа по email (сервер Supabase).
 */
export async function getLoginLockStatus(loginKey) {
  const key = String(loginKey ?? '').trim().toLowerCase()
  if (!key) return normalizeLockStatus(null)

  const { data, error } = await supabase.rpc('get_login_lock_status', {
    p_login_key: key,
  })
  if (error) {
    console.error('[loginLockout] get', error.message)
    return normalizeLockStatus(null)
  }
  return normalizeLockStatus(data)
}

/**
 * Зафиксировать неверный пароль. На 5-й попытке — лок на 3 минуты + ban в Auth.
 */
export async function recordLoginFailure(loginKey) {
  const key = String(loginKey ?? '').trim().toLowerCase()
  if (!key) return normalizeLockStatus(null)

  const { data, error } = await supabase.rpc('record_login_failure', {
    p_login_key: key,
  })
  if (error) {
    console.error('[loginLockout] record', error.message)
    return normalizeLockStatus(null)
  }
  return normalizeLockStatus(data)
}

/** Сброс счётчика после успешного входа. */
export async function clearLoginFailures(loginKey) {
  const key = String(loginKey ?? '').trim().toLowerCase()
  if (!key) return

  const { error } = await supabase.rpc('clear_login_failures', {
    p_login_key: key,
  })
  if (error) console.error('[loginLockout] clear', error.message)
}

export function isAuthBanError(message) {
  return /banned|заблокир/i.test(String(message ?? ''))
}
