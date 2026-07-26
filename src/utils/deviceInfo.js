const DEVICE_KEY = 'todo-device-key'

/** Стабильный id этого браузера (localStorage). */
export function getDeviceKey() {
  try {
    let key = localStorage.getItem(DEVICE_KEY)
    if (!key) {
      key = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, key)
    }
    return key
  } catch {
    return crypto.randomUUID()
  }
}

/** Короткое имя устройства из User-Agent. */
export function getDeviceLabel(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const s = String(ua || '')
  let browser = 'Browser'
  if (/Edg\//i.test(s)) browser = 'Edge'
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome'
  else if (/Firefox\//i.test(s)) browser = 'Firefox'
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari'
  else if (/Opera|OPR\//i.test(s)) browser = 'Opera'

  let os = 'Device'
  if (/Windows/i.test(s)) os = 'Windows'
  else if (/Android/i.test(s)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS'
  else if (/Mac OS X/i.test(s)) os = 'macOS'
  else if (/Linux/i.test(s)) os = 'Linux'

  return `${browser} · ${os}`
}
