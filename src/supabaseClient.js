import { Capacitor } from '@capacitor/core'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

function isProjectSupabaseUrl(url) {
  try {
    const host = new URL(String(url)).hostname
    return host.endsWith('.supabase.co') && host !== 'supabase.co'
  } catch {
    return false
  }
}

/** true, если URL и ключ заданы (локально в .env или в Vercel Environment Variables). */
export const isSupabaseConfigured = Boolean(
  isProjectSupabaseUrl(supabaseUrl) &&
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
 * На вебе (Safari / PWA) ходим через same-origin `/supabase`,
 * иначе iOS WebKit часто отдаёт «Load failed» на кросс-доменный fetch.
 * Нативное приложение бьёт в Supabase напрямую (CapacitorHttp).
 */
function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/i.test(navigator.userAgent)
}

function resolveSupabaseUrl(directUrl) {
  const trimmed = String(directUrl ?? '').replace(/\/$/, '')
  if (!trimmed) return trimmed
  if (Capacitor.isNativePlatform()) return trimmed
  if (typeof window === 'undefined') return trimmed
  // iOS Safari: same-origin proxy (иначе WebKit даёт Load failed).
  // Mac/desktop: прямой URL — нужен realtime между устройствами.
  if (isIosSafari()) return `${window.location.origin}/supabase`
  return trimmed
}

async function fetchWithRetry(input, init) {
  const attempts = 3
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetch(input, init)
    } catch (err) {
      lastError = err
      if (err?.name === 'AbortError') throw err
      await new Promise((resolve) => setTimeout(resolve, 280 * (i + 1)))
    }
  }
  throw lastError
}

const clientUrl = isSupabaseConfigured
  ? resolveSupabaseUrl(supabaseUrl)
  : 'https://placeholder.supabase.co'

/**
 * Единый клиент Supabase.
 * При отсутствии env не падаем с белым экраном — подставляем заглушку.
 */
export const supabase = createClient(
  clientUrl,
  isSupabaseConfigured ? supabaseAnonKey : 'public-anon-key',
  {
    global: { fetch: fetchWithRetry },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: !Capacitor.isNativePlatform(),
    },
  },
)
