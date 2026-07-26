/**
 * Валидация email для регистрации (live + submit).
 *
 * Проверки:
 * 1) не пустой
 * 2) есть ровно один @
 * 3) есть локальная часть и домен
 * 4) в домене есть точка (например mail.com)
 * 5) без пробелов
 */

/** local@domain.tld — без пробелов, одна @, домен с точкой */
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

/**
 * @returns {string | null} ключ i18n или null, если email валиден
 */
export function validateEmail(email) {
  const value = String(email ?? '').trim()

  if (!value) return 'auth.emailRequired'

  if (/\s/.test(value)) return 'auth.emailInvalid'

  if (!value.includes('@')) return 'auth.emailNeedAt'

  const parts = value.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return 'auth.emailInvalid'
  }

  if (!parts[1].includes('.')) return 'auth.emailNeedDomain'

  if (!EMAIL_PATTERN.test(value)) return 'auth.emailInvalid'

  return null
}
