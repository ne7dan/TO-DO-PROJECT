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

/** Убирает из списка уже занятые ники (один запрос, без шторма на iOS). */
export async function filterAvailableNicknames(candidates) {
  const list = [...new Set((Array.isArray(candidates) ? candidates : []).filter(Boolean))]
  if (list.length === 0) return []

  const orFilter = list.map((n) => `nickname.ilike.${n}`).join(',')
  const { data, error } = await supabase.from('profiles').select('nickname').or(orFilter)

  if (error) {
    console.error('[nickname] filter', error.message)
    return list
  }

  const taken = new Set(
    (data ?? []).map((row) => String(row.nickname ?? '').toLowerCase()),
  )
  return list.filter((nick) => !taken.has(nick.toLowerCase()))
}
