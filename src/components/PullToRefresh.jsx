import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Loader2 } from 'lucide-react'

const PULL_THRESHOLD = 72
const PULL_MAX = 100

/**
 * iOS pull-to-refresh.
 * Жест обновляет только transform через DOM (без React-рендеров) — без просадок FPS.
 *
 * @param {object} props
 * @param {import('react').ReactNode} [props.children]
 * @param {import('react').RefObject<HTMLElement|null>} [props.scrollRef]
 * @param {() => void | Promise<void>} [props.onRefresh]
 * @param {boolean} [props.enabled]
 */
export function PullToRefresh({
  children,
  scrollRef,
  onRefresh,
  enabled: enabledProp,
}) {
  const enabled =
    enabledProp ?? Capacitor.getPlatform() === 'ios'
  const [refreshing, setRefreshing] = useState(false)

  const trackRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const spinnerRef = useRef(/** @type {SVGSVGElement|null} */ (null))
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const distanceRef = useRef(0)
  const refreshingRef = useRef(false)
  const rafRef = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  refreshingRef.current = refreshing

  useEffect(() => {
    if (!enabled) return undefined

    const getScrollTop = () => {
      const el = scrollRef?.current
      if (el) return el.scrollTop
      const root = document.getElementById('root')
      return Math.max(
        window.scrollY || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
        root?.scrollTop || 0,
      )
    }

    /**
     * @param {number} dist
     * @param {{ settling?: boolean, spinning?: boolean }} [opts]
     */
    const applyVisual = (dist, opts = {}) => {
      const track = trackRef.current
      const spinner = spinnerRef.current
      if (!track) return

      if (opts.settling) track.classList.add('pull-to-refresh__track--settling')
      else track.classList.remove('pull-to-refresh__track--settling')

      if (dist > 0.5) {
        track.classList.add('pull-to-refresh__track--active')
        track.style.transform = `translate3d(0, ${dist}px, 0)`
      } else {
        track.classList.remove('pull-to-refresh__track--active')
        track.style.transform = ''
      }

      if (!spinner) return
      const progress = Math.min(1, dist / PULL_THRESHOLD)
      const spinning = Boolean(opts.spinning)
      spinner.style.opacity =
        dist > 4 || spinning ? String(spinning ? 1 : progress) : '0'
      if (spinning) {
        spinner.style.transform = ''
        spinner.classList.add('pull-to-refresh__spinner--spin')
      } else {
        spinner.classList.remove('pull-to-refresh__spinner--spin')
        spinner.style.transform =
          dist > 4 ? `rotate(${Math.min(270, dist * 3)}deg)` : ''
      }
    }

    const scheduleVisual = (dist) => {
      distanceRef.current = dist
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0
        applyVisual(distanceRef.current, { spinning: refreshingRef.current })
      })
    }

    const resetVisual = (settling = true) => {
      distanceRef.current = 0
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      applyVisual(0, { settling })
    }

    const listenerTarget = () => scrollRef?.current ?? document

    const onTouchStart = (e) => {
      if (refreshingRef.current) return
      if (
        !scrollRef?.current &&
        e.target instanceof Element &&
        e.target.closest('[role="dialog"]')
      ) {
        pullingRef.current = false
        return
      }
      if (getScrollTop() > 1) {
        pullingRef.current = false
        return
      }
      const touch = e.touches[0]
      if (!touch) return
      startYRef.current = touch.clientY
      pullingRef.current = true
      distanceRef.current = 0
      trackRef.current?.classList.remove('pull-to-refresh__track--settling')
    }

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshingRef.current) return
      if (getScrollTop() > 1) {
        pullingRef.current = false
        resetVisual(false)
        return
      }
      const touch = e.touches[0]
      if (!touch) return
      const delta = touch.clientY - startYRef.current
      if (delta <= 0) {
        if (distanceRef.current !== 0) resetVisual(false)
        return
      }
      const damped = Math.min(PULL_MAX, delta * 0.45)
      scheduleVisual(damped)
      // Блокируем native overscroll только когда уже тянем
      if (damped > 6) e.preventDefault()
    }

    const onTouchEnd = () => {
      if (!pullingRef.current) return
      pullingRef.current = false
      const dist = distanceRef.current

      if (dist >= PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        applyVisual(PULL_THRESHOLD, { settling: true, spinning: true })

        const finish = () => {
          refreshingRef.current = false
          setRefreshing(false)
          resetVisual(true)
        }

        const startedAt = Date.now()
        const waitMin = () => {
          const left = Math.max(0, 420 - (Date.now() - startedAt))
          return new Promise((resolve) => window.setTimeout(resolve, left))
        }

        const runRefresh = async () => {
          const waiters = []
          const run = onRefreshRef.current
          if (typeof run === 'function') {
            waiters.push(Promise.resolve().then(() => run()))
          } else {
            const { reapplyStoredAppearance, PULL_REFRESH_EVENT } =
              await import('../utils/appearance')
            reapplyStoredAppearance()
            window.dispatchEvent(
              new CustomEvent(PULL_REFRESH_EVENT, {
                detail: {
                  wait: (job) => {
                    waiters.push(Promise.resolve(job))
                  },
                },
              }),
            )
          }
          await Promise.all(waiters)
          await waitMin()
        }

        Promise.resolve()
          .then(runRefresh)
          .catch(() => {})
          .finally(finish)
        return
      }

      resetVisual(true)
    }

    const node = listenerTarget()
    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    node.addEventListener('touchend', onTouchEnd, { passive: true })
    node.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchmove', onTouchMove)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, scrollRef])

  if (!enabled) return children ?? null

  return (
    <div
      className={[
        'pull-to-refresh-root',
        !scrollRef ? 'pull-to-refresh-root--page' : 'pull-to-refresh-root--local',
      ].join(' ')}
    >
      <div ref={trackRef} className="pull-to-refresh__track">
        <div
          className="pull-to-refresh"
          aria-hidden={!refreshing}
        >
          <Loader2
            ref={spinnerRef}
            className="pull-to-refresh__spinner text-muted dark:text-zinc-300"
            size={22}
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <div className="pull-to-refresh__content">{children}</div>
      </div>
    </div>
  )
}
