import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import './index.css'
import App from './App.jsx'
import { LocaleProvider } from './i18n/LocaleContext.jsx'
import { PullToRefresh } from './components/PullToRefresh.jsx'
import { isIosNative } from './utils/platform.js'

if (isIosNative()) {
  document.documentElement.classList.add('platform-ios')
  // Отключить pinch/focus-zoom WKWebView (нативное приложение, не сайт)
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
    )
  }
  void import('./lib/pomodoroBackground.ios.js').then((mod) => {
    mod.resetPomodoroAfterColdLaunch()
  })
}

/** Убрать iOS-панель над клавиатурой (стрелки / галочка). */
async function hideKeyboardAccessoryBar() {
  if (Capacitor.getPlatform() !== 'ios') return
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: false })
  } catch {
    // Web / недоступный плагин — игнорируем
  }
}

void hideKeyboardAccessoryBar()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocaleProvider>
      <PullToRefresh>
        <App />
      </PullToRefresh>
    </LocaleProvider>
  </StrictMode>,
)
