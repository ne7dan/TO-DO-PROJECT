/** WebKit на iOS часто маскирует сбой fetch как «Load failed». */
export function isNetworkError(message) {
  const m = String(message ?? '')
  return (
    /load failed/i.test(m) ||
    /failed to fetch/i.test(m) ||
    /networkerror/i.test(m) ||
    /network request failed/i.test(m) ||
    /the internet connection appears to be offline/i.test(m) ||
    /fetch is aborted/i.test(m)
  )
}

export function normalizeAuthError(error) {
  const msg = typeof error === 'string' ? error : error?.message
  if (!msg) return msg
  if (isNetworkError(msg)) return 'network_error'
  return msg
}

export function mapAuthError(error, t, remainingLabel) {
  if (!error) return null
  if (error === 'nickname_not_found') return t('auth.nicknameNotFound')
  if (error === 'empty_login') return t('auth.loginRequired')
  if (error === 'nickname_taken') return t('auth.nicknameTaken')
  if (error === 'email_rate_limit') return t('auth.emailRateLimit')
  if (error === 'network_error' || isNetworkError(error)) {
    return t('auth.networkError')
  }
  if (error === 'login_locked') {
    return remainingLabel
      ? t('auth.loginLocked', { time: remainingLabel })
      : t('auth.loginLockedShort')
  }
  return error
}
