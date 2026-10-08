import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredUrl = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const supabaseTarget =
    configuredUrl.includes('.supabase.co') &&
    !configuredUrl.endsWith('://supabase.co')
      ? configuredUrl
      : 'https://qqyendzatkoaidxlyezl.supabase.co'

  const supabaseProxy = {
    '/supabase': {
      target: supabaseTarget,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(/^\/supabase/, ''),
    },
  }

  return {
    // Relative asset paths — required for Capacitor (file:// / WKWebView)
    base: './',
    plugins: [react(), tailwindcss()],
    server: { proxy: supabaseProxy },
    preview: { proxy: supabaseProxy },
  }
})
