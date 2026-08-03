import { Capacitor } from '@capacitor/core'

/**
 * Нативное iOS-приложение (Capacitor), не мобильный Safari.
 */
export function isIosNative() {
  return Capacitor.getPlatform() === 'ios'
}
