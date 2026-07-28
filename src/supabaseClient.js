import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Новый ключ Publishable; anon — запасной вариант для старых .env
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

/** true, если URL и ключ заданы (локально в .env или в Vercel Environment Variables). */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !String(supabaseAnonKey).includes('your_supabase'),
)

if (!isSupabaseConfigured) {
  console.error(
    '[supabase] Задайте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY ' +
      '(локально: .env; на Vercel: Project → Settings → Environment Variables), ' +
      'затем сделайте Redeploy.',
  )
}

/**
 * Единый клиент Supabase.
 * При отсутствии env не падаем с белым экраном — подставляем заглушку.
 */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'public-anon-key',
)
