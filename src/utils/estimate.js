const MAX_ESTIMATE_MINUTES = 24 * 60 - 1

/** «01:30» / «1:30» → минуты; пусто и 00:00 → 0 */
export function parseEstimateInput(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '00:00') return 0

  const match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number.parseInt(match[1], 10)
  const mins = Number.parseInt(match[2], 10)
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
  if (hours < 0 || mins < 0 || mins > 59) return null

  return normalizeEstimateMinutes(hours * 60 + mins)
}

export function normalizeEstimateMinutes(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(MAX_ESTIMATE_MINUTES, Math.round(n))
}

/** Минуты → значение для `<input type="time">` (HH:MM) */
export function minutesToTimeInput(minutes) {
  const m = normalizeEstimateMinutes(minutes)
  const hours = Math.floor(m / 60)
  const rest = m % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function formatEstimate(minutes, locale = 'ru') {
  const m = normalizeEstimateMinutes(minutes)
  if (m <= 0) return ''
  if (m < 60) {
    return locale === 'en' ? `${m} min` : `${m} мин`
  }
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (rest === 0) {
    return locale === 'en' ? `${hours} h` : `${hours} ч`
  }
  return locale === 'en' ? `${hours} h ${rest} m` : `${hours} ч ${rest} мин`
}

export function formatTracked(seconds, locale = 'ru') {
  const s = Math.max(0, Math.floor(seconds || 0))
  if (s < 60) {
    return locale === 'en' ? `${s}s` : `${s} с`
  }
  return formatEstimate(Math.round(s / 60), locale)
}
