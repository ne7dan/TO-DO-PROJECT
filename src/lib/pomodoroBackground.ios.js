import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

const STORAGE_KEY = 'focus-timer-runtime'
const NOTIF_FOCUS = 71001
const NOTIF_BREAK = 71002
const NOTIF_DONE = 71003

function dropLegacyDiskRuntime() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function loadPomodoroRuntime() {
  dropLegacyDiskRuntime()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function savePomodoroRuntime(state) {
  dropLegacyDiskRuntime()
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}

export function clearPomodoroRuntime() {
  dropLegacyDiskRuntime()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Полный выход из приложения убивает процесс: таймер не восстанавливаем с диска. */
export function resetPomodoroAfterColdLaunch() {
  dropLegacyDiskRuntime()
  if (loadPomodoroRuntime()) return
  void cancelTimerNotifications()
}

export function catchUpTimer({
  now,
  running,
  mode,
  phase,
  seconds,
  endsAt,
  startedAt,
  stopwatchOffset,
  settings,
}) {
  const workSec = Math.max(1, settings.workMin) * 60
  const breakSec = Math.max(0, settings.breakMin) * 60
  const isStopwatch = mode === 'free'

  if (!running) {
    return {
      seconds,
      phase,
      running: false,
      sessionActive: false,
      endsAt: null,
      startedAt: null,
      stopwatchOffset: isStopwatch ? seconds : 0,
      elapsedWork: 0,
      finished: false,
    }
  }

  if (isStopwatch) {
    const start = startedAt || now
    const next = (stopwatchOffset || 0) + Math.max(0, Math.floor((now - start) / 1000))
    return {
      seconds: next,
      phase,
      running: true,
      sessionActive: true,
      endsAt: null,
      startedAt: start,
      stopwatchOffset: stopwatchOffset || 0,
      elapsedWork: Math.max(0, next - seconds),
      finished: false,
    }
  }

  const target = endsAt || now + Math.max(0, seconds) * 1000
  const remainingMs = target - now

  let elapsedWork = 0
  if (mode === 'pomodoro' && phase === 'work') {
    elapsedWork = Math.max(0, seconds - Math.max(0, Math.ceil(remainingMs / 1000)))
  } else if (mode === 'free') {
    elapsedWork = Math.max(0, seconds - Math.max(0, Math.ceil(remainingMs / 1000)))
  }

  if (remainingMs > 0) {
    return {
      seconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      phase,
      running: true,
      sessionActive: true,
      endsAt: target,
      startedAt: null,
      stopwatchOffset: 0,
      elapsedWork,
      finished: false,
    }
  }

  if (mode === 'pomodoro' && phase === 'work') {
    if (breakSec === 0) {
      return {
        seconds: workSec,
        phase: 'work',
        running: false,
        sessionActive: false,
        endsAt: null,
        startedAt: null,
        stopwatchOffset: 0,
        elapsedWork,
        finished: true,
      }
    }

    const breakRemainingMs = remainingMs + breakSec * 1000
    if (breakRemainingMs > 0) {
      return {
        seconds: Math.max(1, Math.ceil(breakRemainingMs / 1000)),
        phase: 'break',
        running: true,
        sessionActive: true,
        endsAt: now + breakRemainingMs,
        startedAt: null,
        stopwatchOffset: 0,
        elapsedWork,
        finished: false,
      }
    }

    return {
      seconds: workSec,
      phase: 'work',
      running: false,
      sessionActive: false,
      endsAt: null,
      startedAt: null,
      stopwatchOffset: 0,
      elapsedWork,
      finished: true,
    }
  }

  if (mode === 'pomodoro' && phase === 'break') {
    return {
      seconds: workSec,
      phase: 'work',
      running: false,
      sessionActive: false,
      endsAt: null,
      startedAt: null,
      stopwatchOffset: 0,
      elapsedWork: 0,
      finished: true,
    }
  }

  return {
    seconds: 0,
    phase,
    running: false,
    sessionActive: false,
    endsAt: null,
    startedAt: null,
    stopwatchOffset: 0,
    elapsedWork,
    finished: true,
  }
}

async function ensurePermission() {
  if (!Capacitor.isNativePlatform()) return false
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  const next = await LocalNotifications.requestPermissions()
  return next.display === 'granted'
}

export async function cancelTimerNotifications() {
  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: NOTIF_FOCUS },
        { id: NOTIF_BREAK },
        { id: NOTIF_DONE },
      ],
    })
  } catch {
    /* plugin unavailable in browser */
  }
}

export async function scheduleTimerNotifications({
  endsAt,
  mode,
  phase,
  breakMin,
  titles,
}) {
  await cancelTimerNotifications()
  if (!endsAt || endsAt <= Date.now()) return
  const allowed = await ensurePermission()
  if (!allowed) return

  const notifications = []

  if (mode === 'pomodoro' && phase === 'work') {
    notifications.push({
      id: NOTIF_FOCUS,
      title: titles.app,
      body: titles.focusDone,
      schedule: { at: new Date(endsAt), allowWhileIdle: true },
      sound: 'default',
    })
    const breakMs = Math.max(0, breakMin) * 60 * 1000
    if (breakMs > 0) {
      notifications.push({
        id: NOTIF_BREAK,
        title: titles.app,
        body: titles.breakDone,
        schedule: { at: new Date(endsAt + breakMs), allowWhileIdle: true },
        sound: 'default',
      })
    }
  } else if (mode === 'pomodoro' && phase === 'break') {
    notifications.push({
      id: NOTIF_BREAK,
      title: titles.app,
      body: titles.breakDone,
      schedule: { at: new Date(endsAt), allowWhileIdle: true },
      sound: 'default',
    })
  } else {
    notifications.push({
      id: NOTIF_DONE,
      title: titles.app,
      body: titles.timerDone,
      schedule: { at: new Date(endsAt), allowWhileIdle: true },
      sound: 'default',
    })
  }

  try {
    await LocalNotifications.schedule({ notifications })
  } catch {
    /* ignore schedule errors */
  }
}

export function onAppForeground(handler) {
  let removed = false
  let appHandle = null

  const visibility = () => {
    if (document.visibilityState === 'visible') handler()
  }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('focus', handler)

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) handler()
  }).then((handle) => {
    if (removed) {
      handle.remove()
      return
    }
    appHandle = handle
  })

  return () => {
    removed = true
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('focus', handler)
    appHandle?.remove()
  }
}
