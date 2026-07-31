import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths — required for Capacitor (file:// / WKWebView)
  base: './',
  plugins: [react(), tailwindcss()],
})
