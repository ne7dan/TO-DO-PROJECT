import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Новый ключ Publishable; anon — запасной вариант для старых .env
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Задайте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в файле .env',
  )
}

/** Единый клиент Supabase для auth и запросов к таблице todos. */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
