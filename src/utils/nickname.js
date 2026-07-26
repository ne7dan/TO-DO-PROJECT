/** Никнейм: буквы (в т.ч. кириллица), цифры, _ и -. Без пробелов и спецсимволов. */
export const NICKNAME_MIN = 3
export const NICKNAME_MAX = 24

const ALLOWED = /^[\p{L}\p{N}_-]+$/u
const SEPARATORS = ['_', '-']

/** Убирает запрещённые символы при вводе. */
export function sanitizeNicknameInput(value) {
  return String(value ?? '')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, NICKNAME_MAX)
}

/**
 * @returns {'empty'|'tooShort'|'invalidChars'|null}
 */
export function validateNickname(value) {
  const nick = String(value ?? '').trim()
  if (!nick) return 'empty'
  if (nick.length < NICKNAME_MIN) return 'tooShort'
  if (!ALLOWED.test(nick)) return 'invalidChars'
  return null
}

function fitNick(value) {
  const nick = sanitizeNicknameInput(value)
  if (nick.length < NICKNAME_MIN) return null
  return nick.slice(0, NICKNAME_MAX)
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/** Случайная строка цифр длины len. */
function randomDigits(len) {
  let out = ''
  for (let i = 0; i < len; i += 1) out += String(randomInt(0, 9))
  return out
}

function randomSep() {
  return SEPARATORS[randomInt(0, SEPARATORS.length - 1)]
}

/**
 * Случайный суффикс/вариация базы: цифры и допустимые _ / -.
 * Примеры: name_847, name-392, na_me91, name4821
 */
export function randomizeNickname(base) {
  const root = sanitizeNicknameInput(base)
  if (!root) return null

  const room = Math.max(0, NICKNAME_MAX - root.length)
  const patterns = [
    // name_847 / name-3921
    () => {
      const digits = randomDigits(Math.min(room - 1, randomInt(2, 4)))
      if (digits.length < 2 || room < 3) return `${root.slice(0, NICKNAME_MAX - 3)}${randomSep()}${randomDigits(2)}`
      return `${root}${randomSep()}${digits}`
    },
    // name8472 (без разделителя)
    () => {
      const n = Math.min(Math.max(2, room), randomInt(2, 4))
      const trimmed = root.slice(0, NICKNAME_MAX - n)
      return `${trimmed}${randomDigits(n)}`
    },
    // name_12-89
    () => {
      const a = randomDigits(2)
      const b = randomDigits(2)
      const sep1 = randomSep()
      const sep2 = randomSep()
      const extra = sep1.length + a.length + sep2.length + b.length
      const trimmed = root.slice(0, Math.max(NICKNAME_MIN, NICKNAME_MAX - extra))
      return `${trimmed}${sep1}${a}${sep2}${b}`
    },
    // na_me42 / na-me_7 (разделитель внутри базы)
    () => {
      if (root.length < 4) {
        return `${root}${randomSep()}${randomDigits(randomInt(2, 3))}`
      }
      const mid = randomInt(2, root.length - 1)
      const left = root.slice(0, mid)
      const right = root.slice(mid)
      const digits = randomDigits(randomInt(1, 3))
      return `${left}${randomSep()}${right}${digits}`
    },
  ]

  const pick = patterns[randomInt(0, patterns.length - 1)]
  return fitNick(pick())
}

/**
 * Несколько уникальных вариантов ника из базы.
 */
export function generateNicknameVariants(base, count = 3) {
  const unique = []
  const seen = new Set()
  const root = sanitizeNicknameInput(base)
  if (!root) return unique

  const plain = fitNick(root)
  if (plain) {
    seen.add(plain.toLowerCase())
    unique.push(plain)
  }

  let attempts = 0
  const maxAttempts = Math.max(40, count * 25)
  while (unique.length < count && attempts < maxAttempts) {
    attempts += 1
    const nick = randomizeNickname(root)
    if (!nick) continue
    const key = nick.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(nick)
  }

  return unique
}

/**
 * Варианты никнейма из email (локальная часть до @) + рандомные цифры/_/-.
 */
export function suggestNicknamesFromEmail(email) {
  const local = String(email ?? '').trim().split('@')[0] ?? ''
  if (!local || !String(email).includes('@')) return []

  const cleaned = sanitizeNicknameInput(local.replace(/[.+]/g, '_'))
  const compact = sanitizeNicknameInput(local.replace(/[._+-]/g, ''))
  const parts = local.split(/[._+-]+/).filter(Boolean)
  const first = parts[0] ? sanitizeNicknameInput(parts[0]) : ''

  const bases = [cleaned, compact, first].filter(
    (b, i, arr) => b && b.length >= NICKNAME_MIN && arr.indexOf(b) === i,
  )
  if (bases.length === 0) return []

  const unique = []
  const seen = new Set()

  const push = (nick) => {
    if (!nick) return
    const key = nick.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    unique.push(nick)
  }

  // Один «чистый» вариант + рандомные на разных базах
  push(fitNick(bases[0]))

  let attempts = 0
  while (unique.length < 3 && attempts < 60) {
    attempts += 1
    const base = bases[randomInt(0, bases.length - 1)]
    push(randomizeNickname(base))
  }

  // Если базы короткие / коллизии — добираем только рандомом от первой базы
  while (unique.length < 3 && attempts < 100) {
    attempts += 1
    push(randomizeNickname(bases[0]))
  }

  return unique.slice(0, 3)
}
