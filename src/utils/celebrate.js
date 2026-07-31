import confetti from 'canvas-confetti'
import { readAccentColors } from './appearance'

/** Короткий салют при 100% закрытых целях дня. */
export function celebrateDayComplete() {
  const [accent, soft, hover] = readAccentColors()
  const colors = [accent, soft, hover, '#D4B687', '#E8DFD0']

  const defaults = {
    disableForReducedMotion: true,
    zIndex: 9999,
  }

  confetti({
    ...defaults,
    particleCount: 70,
    spread: 68,
    startVelocity: 38,
    origin: { y: 0.68 },
    colors,
  })

  window.setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 40,
      angle: 60,
      spread: 50,
      origin: { x: 0.15, y: 0.72 },
      colors: [accent, soft, '#D4C09A'],
    })
    confetti({
      ...defaults,
      particleCount: 40,
      angle: 120,
      spread: 50,
      origin: { x: 0.85, y: 0.72 },
      colors: [hover, '#D4B687', soft],
    })
  }, 160)
}
