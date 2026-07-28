const DEVICE_KEY = 'todo-device-key'

/** Стабильный id этого браузера (localStorage → sessionStorage fallback). */
export function getDeviceKey() {
  try {
    let key = localStorage.getItem(DEVICE_KEY)
    if (!key) {
      key = sessionStorage.getItem(DEVICE_KEY)
    }
    if (!key) {
      key = crypto.randomUUID()
    }
    localStorage.setItem(DEVICE_KEY, key)
    try {
      sessionStorage.setItem(DEVICE_KEY, key)
    } catch {
      // ignore
    }
    return key
  } catch {
    try {
      let key = sessionStorage.getItem(DEVICE_KEY)
      if (!key) {
        key = crypto.randomUUID()
        sessionStorage.setItem(DEVICE_KEY, key)
      }
      return key
    } catch {
      return 'anon-device'
    }
  }
}

/** Короткое имя устройства из User-Agent. */
export function getDeviceLabel(
  ua = typeof navigator !== 'undefined' ? navigator.userAgent : '',
) {
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

/**
 * Оставляет по одной записи на label (самую свежую).
 * Если есть текущий device_key — предпочитает его.
 */
export function dedupeDevicesByLabel(devices, currentKey = null) {
  const list = Array.isArray(devices) ? devices : []
  const byLabel = new Map()

  for (const device of list) {
    if (!device?.label) continue
    const prev = byLabel.get(device.label)
    if (!prev) {
      byLabel.set(device.label, device)
      continue
    }

    const prevIsCurrent = Boolean(currentKey && prev.device_key === currentKey)
    const nextIsCurrent = Boolean(currentKey && device.device_key === currentKey)
    if (nextIsCurrent && !prevIsCurrent) {
      byLabel.set(device.label, device)
      continue
    }
    if (prevIsCurrent && !nextIsCurrent) continue

    const prevSeen = Date.parse(prev.last_seen || 0) || 0
    const nextSeen = Date.parse(device.last_seen || 0) || 0
    if (nextSeen >= prevSeen) byLabel.set(device.label, device)
  }

  return Array.from(byLabel.values()).sort((a, b) => {
    const aSeen = Date.parse(a.last_seen || 0) || 0
    const bSeen = Date.parse(b.last_seen || 0) || 0
    return bSeen - aSeen
  })
}
