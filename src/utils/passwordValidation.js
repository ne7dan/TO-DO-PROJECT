/**
 * Строгая валидация пароля при регистрации.
 *
 * Разрешено: буквы (EN/RU), цифры и только спецсимволы: - _ & . / \ | ( )
 * Требования: ≥8 символов, ≥5 букв, ≥1 заглавная.
 */

/** Минимальная длина пароля */
export const PASSWORD_MIN_LENGTH = 8

/**
 * Разрешённый алфавит целиком (весь пароль должен состоять только из этого).
 *
 * ^ … $     — вся строка от начала до конца
 * A-Za-z    — латинские буквы
 * А-Яа-яЁё  — русские буквы (включая Ё/ё)
 * 0-9       — цифры
 * \-_&./\\|() — спецсимволы: - _ & . / \ | ( )
 *   (в классе: \- для дефиса, \\ для обратного слэша, \| для вертикальной черты)
 */
const ALLOWED_PASSWORD_CHARS = /^[A-Za-zА-Яа-яЁё0-9\-_&./\\|()]+$/u

/**
 * Любая буква (EN/RU, любой регистр) — для подсчёта «минимум 5 букв».
 * g + match() даёт массив всех вхождений.
 */
const LETTERS = /[A-Za-zА-Яа-яЁё]/gu

/**
 * Хотя бы одна заглавная: латиница A–Z или кириллица А–Я / Ё.
 */
const HAS_UPPERCASE = /[A-ZА-ЯЁ]/u

/**
 * @returns {string | null} ключ ошибки i18n или null, если пароль валиден
 */
export function validateSignUpPassword(password) {
  const value = String(password ?? '')

  if (value.length < PASSWORD_MIN_LENGTH) {
    return 'auth.passwordMinLength'
  }

  // Запрещённые символы: что угодно вне ALLOWED_PASSWORD_CHARS
  if (!ALLOWED_PASSWORD_CHARS.test(value)) {
    return 'auth.passwordForbiddenChars'
  }

  const letterCount = value.match(LETTERS)?.length ?? 0
  if (letterCount < 5) {
    return 'auth.passwordNeedLetters'
  }

  if (!HAS_UPPERCASE.test(value)) {
    return 'auth.passwordNeedUppercase'
  }

  return null
}
