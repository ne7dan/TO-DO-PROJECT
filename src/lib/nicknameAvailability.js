import { supabase } from '../supabaseClient'

/**
 * Проверяет, свободен ли никнейм (без учёта регистра).
 * @param {string} nickname
 * @param {string | null} [excludeUserId] — свой id при смене ника
 */
export async function isNicknameAvailable(nickname, excludeUserId = null) {
  const nick = String(nickname ?? '').trim()
  if (!nick) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('nickname', nick)
    .maybeSingle()

  if (error) {
    console.error('[nickname] availability', error.message)
    // при сбое проверки не блокируем UI жёстко — БД всё равно с unique index
    return true
  }

  if (!data) return true
  if (excludeUserId && data.id === excludeUserId) return true
  return false
}

/** Убирает из списка уже занятые ники. */
export async function filterAvailableNicknames(candidates) {
  const list = Array.isArray(candidates) ? candidates : []
  const available = []

  for (const nick of list) {
    // eslint-disable-next-line no-await-in-loop
    const free = await isNicknameAvailable(nick)
    if (free) available.push(nick)
  }

  return available
}
