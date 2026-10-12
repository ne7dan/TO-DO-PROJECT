import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import {
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  X,
} from 'lucide-react'
import { displayTodoText } from '../utils/text'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLocale } from '../i18n/LocaleContext'
import {
  cancelTimerNotifications,
  catchUpTimer,
  clearPomodoroRuntime,
  loadPomodoroRuntime,
  onAppForeground,
  savePomodoroRuntime,
  scheduleTimerNotifications,
} from '../lib/pomodoroBackground.ios'

const DEFAULT_WORK_MIN = 25
const DEFAULT_BREAK_MIN = 5
const MAX_MINUTES = 999
const ADJUST_STEP_MIN = 5
const CONTROLS_IDLE_MS = 2200

function clampMinutes(value, fallback) {
  const n = Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(MAX_MINUTES, n)
}

function formatTimeParts(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  return { h, m, s, key: safe }
}

function formatTime(totalSeconds) {
  const { h, m, s } = formatTimeParts(totalSeconds)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Принимает `mm`, `mm:ss` или `h:mm:ss`. Возвращает секунды или null. */
function parseTimeInput(value) {
  const trimmed = String(value).trim().replace(',', '.')
  if (!trimmed) return null

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    if (parts.length < 2 || parts.length > 3) return null
    const nums = parts.map((p) => Number.parseInt(p, 10))
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null
    if (parts.length === 2) {
      const [m, s] = nums
      if (s > 59) return null
      return Math.min(MAX_MINUTES * 60, m * 60 + s)
    }
    const [h, m, s] = nums
    if (m > 59 || s > 59) return null
    return Math.min(MAX_MINUTES * 60, h * 3600 + m * 60 + s)
  }

  const asNumber = Number.parseFloat(trimmed)
  if (!Number.isFinite(asNumber) || asNumber < 0) return null
  return Math.min(MAX_MINUTES * 60, Math.round(asNumber * 60))
}

function BlinkColon({ running }) {
  return (
    <span
      aria-hidden
      className={running ? 'animate-colon-blink inline-block px-[0.02em]' : 'inline-block px-[0.02em]'}
    >
      :
    </span>
  )
}

function LiquidWaveLayer({ className, d }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
    >
      <path fill="currentColor" d={d} />
    </svg>
  )
}

function ZenLiquidFill({ level, finishing = false, active = false }) {
  const clamped = Math.min(100, Math.max(0, level))

  return (
    <div
      className={[
        'pomodoro-zen-liquid',
        active ? 'is-active' : '',
        finishing ? 'animate-liquid-finish' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    >
      <div
        className="pomodoro-zen-liquid__body"
        style={{ height: `${clamped}%` }}
      >
        <div className="pomodoro-zen-liquid__meniscus" />
        <div className="pomodoro-zen-liquid__surface">
          <LiquidWaveLayer
            className="pomodoro-zen-liquid__wave pomodoro-zen-liquid__wave--back"
            d="M0 48 C 80 12, 160 72, 240 40 S 400 8, 480 44 640 78, 720 38 880 6, 960 46 1120 74, 1200 40 V80 H0 Z"
          />
          <LiquidWaveLayer
            className="pomodoro-zen-liquid__wave pomodoro-zen-liquid__wave--mid"
            d="M0 40 C 100 70, 180 8, 280 42 S 460 76, 560 34 740 4, 840 48 1020 72, 1200 36 V80 H0 Z"
          />
          <LiquidWaveLayer
            className="pomodoro-zen-liquid__wave pomodoro-zen-liquid__wave--front"
            d="M0 34 C 70 4, 140 58, 210 30 S 350 2, 430 38 570 68, 650 28 790 0, 880 40 1020 64, 1200 32 V80 H0 Z"
          />
          <div className="pomodoro-zen-liquid__foam" />
        </div>
        <div className="pomodoro-zen-liquid__fill" />
        <div className="pomodoro-zen-liquid__caustics" />
        <div className="pomodoro-zen-liquid__sheen" />
        <div className="pomodoro-zen-liquid__bubbles">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      {finishing && <div className="pomodoro-zen-liquid__ring animate-liquid-finish-ring" />}
    </div>
  )
}

function EditableTimeDisplay({
  seconds,
  running,
  onCommit,
  className,
  inputClassName,
  editOnSingleTap = false,
}) {
  const { t } = useLocale()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const closedRef = useRef(false)
  const { h, m, s } = formatTimeParts(seconds)

  const startEdit = () => {
    if (running) return
    closedRef.current = false
    setDraft(formatTime(seconds))
    setEditing(true)
  }

  useEffect(() => {
    if (!editing) return undefined
    const el = inputRef.current
    if (!el) return undefined
    el.focus()
    el.select()
    return undefined
  }, [editing])

  const finish = (shouldSave) => {
    if (closedRef.current) return
    closedRef.current = true
    setEditing(false)
    if (!shouldSave) return
    const parsed = parseTimeInput(draft)
    if (parsed == null) return
    onCommit(parsed)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label={t('pomodoro.editTime')}
        title={t('pomodoro.editTimeFormat')}
        onChange={(e) => setDraft(e.target.value.replace(/[.,]/g, ':'))}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(true)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            finish(false)
          }
        }}
        className={['pomodoro-time-input', inputClassName].filter(Boolean).join(' ')}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={editOnSingleTap ? startEdit : undefined}
      onDoubleClick={editOnSingleTap ? undefined : startEdit}
      disabled={running}
      title={
        running ? t('pomodoro.editTimeRunning') : t('pomodoro.editTimeHint')
      }
      className={className}
    >
      {h > 0 && (
        <>
          <span>{h}</span>
          <BlinkColon running={running} />
        </>
      )}
      <span>{String(m).padStart(2, '0')}</span>
      <BlinkColon running={running} />
      <span
        key={running ? `s-${s}` : 's-static'}
        className={running ? 'animate-sec-tick' : undefined}
      >
        {String(s).padStart(2, '0')}
      </span>
    </button>
  )
}

function getZenStatus(mode, phase, t) {
  if (mode === 'free') return t('pomodoro.status.free')
  if (phase === 'break') return t('pomodoro.status.break')
  return t('pomodoro.status.focus')
}

function LiveIndicator({ running, size = 'sm' }) {
  const { t } = useLocale()
  const dim = size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2'

  return (
    <span
      className={`relative flex ${dim} shrink-0`}
      aria-label={running ? t('pomodoro.running') : t('pomodoro.paused')}
      title={running ? t('pomodoro.live') : t('pomodoro.pause')}
    >
      {running && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70 blur-sm animate-pulse" />
      )}
      <span
        className={[
          `relative inline-flex ${dim} rounded-full bg-red-500`,
          running
            ? 'shadow-[0_0_8px_2px_rgba(239,68,68,0.7)] animate-pulse'
            : 'shadow-[0_0_4px_1px_rgba(239,68,68,0.45)]',
        ].join(' ')}
      />
    </span>
  )
}

function ModeToggle({ mode, onChange }) {
  const { t } = useLocale()

  return (
    <div className="flex rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 p-1.5 bg-zinc-100/80 dark:bg-zinc-950/60">
      {[
        { id: 'pomodoro', label: t('pomodoro.mode.pomodoro') },
        { id: 'free', label: t('pomodoro.mode.free') },
      ].map((item) => {
        const selected = mode === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={[
              'flex-1 min-h-12 rounded-xl px-3 py-3 text-[15px] font-medium leading-none transition-all duration-200',
              selected
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function FocusGoalPicker({
  focusTask,
  focusOptions,
  onSelectFocus,
  onClearFocus,
  compact = false,
}) {
  const { t } = useLocale()
  const selectId = useId()
  const value = focusTask?.id ?? ''

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={selectId}
          className="text-[10px] uppercase tracking-[0.16em] text-zinc-400"
        >
          {t('pomodoro.focusGoal')}
        </label>
        {focusTask && (
          <button
            type="button"
            onClick={onClearFocus}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={12} />
            {t('pomodoro.clearFocus')}
          </button>
        )}
      </div>

      <select
        id={selectId}
        value={value}
        onChange={(e) => {
          const id = e.target.value
          if (!id) {
            onClearFocus()
            return
          }
          const next = focusOptions.find((todo) => todo.id === id)
          if (next) onSelectFocus(next)
        }}
        className={[
          'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500',
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        ].join(' ')}
      >
        <option value="">{t('pomodoro.noGoal')}</option>
        {focusOptions.map((todo) => (
          <option key={todo.id} value={todo.id}>
            {displayTodoText(todo.text)}
          </option>
        ))}
      </select>
    </div>
  )
}

function SettingsPanel({
  mode,
  workMin,
  breakMin,
  freeMin,
  onChangeWork,
  onChangeBreak,
  onChangeFree,
  onApply,
  onClose,
  embedded = false,
}) {
  const { t } = useLocale()
  const workId = useId()
  const breakId = useId()
  const freeId = useId()

  return (
    <div
      className={[
        'rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/70 p-3 space-y-2.5',
        embedded ? '' : 'mt-3 animate-fade-in',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          {t('pomodoro.settingsTitle')}
        </p>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="btn-danger-hover p-1 rounded-md text-zinc-400"
            aria-label={t('pomodoro.settingsClose')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {mode === 'pomodoro' ? (
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor={workId} className="space-y-1">
            <span className="block text-[11px] text-zinc-500">
              {t('pomodoro.workMin')}
            </span>
            <input
              id={workId}
              type="number"
              min={1}
              max={MAX_MINUTES}
              value={workMin}
              onChange={(e) => onChangeWork(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 text-base tabular-nums outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            />
          </label>
          <label htmlFor={breakId} className="space-y-1">
            <span className="block text-[11px] text-zinc-500">
              {t('pomodoro.breakMin')}
            </span>
            <input
              id={breakId}
              type="number"
              min={0}
              max={MAX_MINUTES}
              value={breakMin}
              onChange={(e) => onChangeBreak(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 text-base tabular-nums outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            />
          </label>
        </div>
      ) : (
        <label htmlFor={freeId} className="block space-y-1">
          <span className="block text-[11px] text-zinc-500">
            {t('pomodoro.freeMin')}
          </span>
          <input
            id={freeId}
            type="number"
            min={0}
            max={MAX_MINUTES}
            value={freeMin}
            onChange={(e) => onChangeFree(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 text-base tabular-nums outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
          />
        </label>
      )}

      <button
        type="button"
        onClick={onApply}
        className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {t('pomodoro.apply')}
      </button>
    </div>
  )
}

function TimerControls({ running, onToggle, onReset, size = 'md' }) {
  const { t } = useLocale()
  const isLarge = size === 'lg'

  return (
    <div className="flex items-center justify-center gap-2.5">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 font-medium shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.97]',
          isLarge
            ? 'min-w-[9.5rem] px-7 py-3.5 text-base'
            : 'min-w-[7.5rem] px-5 py-2.5 text-sm',
        ].join(' ')}
      >
        {running ? (
          <Pause size={isLarge ? 18 : 15} strokeWidth={2.25} />
        ) : (
          <Play
            size={isLarge ? 18 : 15}
            strokeWidth={2.25}
            className="translate-x-px"
          />
        )}
        {running ? t('pomodoro.pause') : t('pomodoro.start')}
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label={t('pomodoro.reset')}
        className={[
          'inline-flex items-center justify-center rounded-full border border-zinc-200/90 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 active:scale-95',
          isLarge ? 'h-12 w-12' : 'h-10 w-10',
        ].join(' ')}
      >
        <RotateCcw size={isLarge ? 17 : 15} strokeWidth={1.75} />
      </button>
    </div>
  )
}

function AdjustButtons({ onAdjust, size = 'md' }) {
  const { t } = useLocale()
  const isLarge = size === 'lg'
  const iconSize = isLarge ? 16 : 14

  const btnClass = [
    'group inline-flex items-center justify-center gap-1 rounded-full border border-zinc-200/90 dark:border-zinc-700/90',
    'bg-white/90 dark:bg-zinc-900/90 text-zinc-600 dark:text-zinc-300 shadow-sm',
    'transition-all duration-200',
    'hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900',
    'dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
    'active:scale-95 active:bg-zinc-100 dark:active:bg-zinc-800',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50',
    isLarge ? 'h-11 min-w-[4.75rem] px-4 text-sm' : 'h-9 min-w-[4.25rem] px-3 text-xs',
  ].join(' ')

  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full border border-zinc-200/70 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-950/60',
        isLarge ? 'p-1.5' : 'p-1',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onAdjust(-ADJUST_STEP_MIN)}
        aria-label={t('pomodoro.minusMin', { n: ADJUST_STEP_MIN })}
        className={btnClass}
      >
        <Minus
          size={iconSize}
          strokeWidth={2.25}
          className="opacity-70 group-hover:opacity-100"
        />
        <span className="font-customMono tabular-nums font-medium tracking-tight">
          {ADJUST_STEP_MIN}
        </span>
      </button>
      <span
        className={[
          'font-display uppercase tracking-[0.14em] text-zinc-400 select-none',
          isLarge ? 'px-2 text-[10px]' : 'px-1.5 text-[9px]',
        ].join(' ')}
      >
        {t('pomodoro.min')}
      </span>
      <button
        type="button"
        onClick={() => onAdjust(ADJUST_STEP_MIN)}
        aria-label={t('pomodoro.plusMin', { n: ADJUST_STEP_MIN })}
        className={btnClass}
      >
        <Plus
          size={iconSize}
          strokeWidth={2.25}
          className="opacity-70 group-hover:opacity-100"
        />
        <span className="font-customMono tabular-nums font-medium tracking-tight">
          {ADJUST_STEP_MIN}
        </span>
      </button>
    </div>
  )
}

function ZenMode({
  seconds,
  mode,
  sessionMode,
  phase,
  running,
  showLive,
  liquidLevel,
  finishPulse,
  focusTask,
  focusOptions,
  onSelectFocus,
  onClearFocus,
  onSwitchMode,
  onClose,
  onToggle,
  onReset,
  onAdjust,
  onSetCustomTime,
  workMin,
  breakMin,
  freeMin,
  onChangeWork,
  onChangeBreak,
  onChangeFree,
  onApplySettings,
}) {
  const { t } = useLocale()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [inputFocused, setInputFocused] = useState(false)
  const idleTimerRef = useRef(null)
  const scrollRef = useRef(null)
  const settingsRef = useRef(null)
  const zenRef = useRef(null)
  const inputFocusedRef = useRef(false)
  const hiddenRef = useRef(false)
  const touchRef = useRef(null)
  inputFocusedRef.current = inputFocused

  const setChrome = useCallback((visible) => {
    hiddenRef.current = !visible
    setControlsVisible(visible)
    zenRef.current?.classList.toggle('is-chrome-hidden', !visible)
    zenRef.current?.classList.toggle('is-chrome-held', Boolean(inputFocusedRef.current))
  }, [])

  const revealControls = useCallback((sticky = false) => {
    setChrome(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (sticky || inputFocusedRef.current) return
    idleTimerRef.current = window.setTimeout(() => {
      if (inputFocusedRef.current) return
      const active = document.activeElement
      if (
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
      ) {
        return
      }
      if (active instanceof HTMLElement) active.blur()
      setChrome(false)
    }, CONTROLS_IDLE_MS)
  }, [setChrome])

  const onTouchStartReveal = useCallback((event) => {
    const t = event.changedTouches[0]
    if (!t) return
    touchRef.current = { x: t.clientX, y: t.clientY, at: Date.now() }
  }, [])

  const onTouchEndReveal = useCallback(
    (event) => {
      const start = touchRef.current
      touchRef.current = null
      if (!start) return
      const t = event.changedTouches[0]
      if (!t) return
      const dist = Math.hypot(t.clientX - start.x, t.clientY - start.y)
      if (Date.now() - start.at > 650 || dist > 16) return
      if (!hiddenRef.current && event.target instanceof Element) {
        if (event.target.closest('button, input, select, textarea, label')) return
      }
      revealControls(inputFocusedRef.current)
    },
    [revealControls],
  )

  useEffect(() => {
    revealControls()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [revealControls])

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios') return undefined

    let showSub
    let hideSub

    const bind = async () => {
      showSub = await Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardInset(Math.max(0, info.keyboardHeight || 0))
      })
      hideSub = await Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardInset(0)
      })
    }

    void bind()

    return () => {
      void showSub?.remove()
      void hideSub?.remove()
    }
  }, [])

  /** При фокусе на инпут — держим контролы и прокручиваем к полям минут. */
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return undefined

    const scrollToSettings = () => {
      const target = settingsRef.current
      if (!target) return
      window.setTimeout(() => {
        target.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth',
        })
      }, 120)
    }

    const onFocusIn = (e) => {
      const el = e.target
      if (!(el instanceof HTMLElement)) return
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
        return
      }
      setInputFocused(true)
      revealControls(true)
      scrollToSettings()
      window.setTimeout(() => {
        el.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth',
        })
      }, 280)
    }

    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement
        const stillInside =
          active instanceof HTMLElement && root.contains(active) &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
        if (stillInside) return
        setInputFocused(false)
        revealControls(false)
      }, 0)
    }

    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)
    return () => {
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
    }
  }, [revealControls])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const viewingOther = mode !== sessionMode
  const status = getZenStatus(viewingOther && !showLive ? mode : sessionMode, phase, t)
  const focusLabel = focusTask ? displayTodoText(focusTask.text) : ''
  const showControls = controlsVisible || inputFocused
  const clockLocked = running || viewingOther

  return (
    <div
      ref={zenRef}
      className={[
        'pomodoro-zen fixed inset-0 z-[100] flex flex-col items-center animate-fade-in',
        showControls ? '' : 'is-chrome-hidden',
        inputFocused ? 'is-chrome-held' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onTouchStart={onTouchStartReveal}
      onTouchEnd={onTouchEndReveal}
      role="dialog"
      aria-modal="true"
      aria-label={t('pomodoro.zen')}
      style={{ ['--keyboard-inset']: `${keyboardInset}px` }}
    >
      <div className="pomodoro-zen__glow" aria-hidden />
      {sessionMode === 'pomodoro' && (
        <ZenLiquidFill
          level={liquidLevel}
          finishing={finishPulse}
          active={running && !viewingOther}
        />
      )}
      {sessionMode === 'free' && (
        <div
          className={['pomodoro-flow-pulse', running ? 'is-running' : ''].join(' ')}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('pomodoro.zenCollapse')}
        className="pomodoro-zen__chrome absolute right-[max(1rem,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+1.75rem)] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 text-zinc-600 backdrop-blur hover:bg-white dark:border-white/10 dark:bg-black/40 dark:text-zinc-300 dark:hover:bg-black/60"
      >
        <Minimize2 size={18} />
      </button>

      <div
        ref={scrollRef}
        className="zen-scroll relative z-10 flex h-full w-full max-w-xl flex-col items-center overflow-y-auto overscroll-contain px-6 py-[max(5rem,calc(env(safe-area-inset-top)+4rem))]"
        style={{
          paddingBottom: `calc(max(2rem, env(safe-area-inset-bottom, 0px)) + var(--keyboard-inset, 0px) + 1.5rem)`,
        }}
      >
        <div className="mb-6 flex w-full items-center justify-center sm:mb-8">
          <div className="flex items-center gap-2.5">
            <p className="font-display text-xs uppercase tracking-[0.28em] text-zinc-400 sm:text-sm">
              {status}
            </p>
            {showLive && (
              <span className="pomodoro-zen__chrome inline-flex">
                <LiveIndicator running={running} size="lg" />
              </span>
            )}
          </div>
        </div>

        <EditableTimeDisplay
          seconds={seconds}
          running={clockLocked}
          onCommit={onSetCustomTime}
          editOnSingleTap
          className={[
            'font-customMono font-bold tabular-nums tracking-tight leading-none text-[clamp(4.5rem,18vw,9.5rem)] text-zinc-900 dark:text-zinc-50 select-none',
            clockLocked ? 'cursor-default' : 'cursor-text',
          ].join(' ')}
          inputClassName="w-full max-w-full text-center bg-transparent border-b-2 border-zinc-300 dark:border-zinc-600 outline-none font-customMono font-bold tabular-nums tracking-tight leading-none text-[clamp(4.5rem,18vw,9.5rem)] text-zinc-900 dark:text-zinc-50"
        />

        {!viewingOther && mode !== 'free' && (
          <div className="pomodoro-zen__chrome mt-6 flex justify-center">
            <AdjustButtons onAdjust={onAdjust} size="lg" />
          </div>
        )}

        {focusLabel && (
          <p className="mt-6 max-w-xl truncate text-center text-lg text-zinc-400 sm:text-xl">
            {focusLabel}
          </p>
        )}

        <div className="pomodoro-zen__chrome mt-8 w-full space-y-4 sm:mt-12">
          <ModeToggle mode={mode} onChange={onSwitchMode} />

          {mode !== 'free' && (!running || viewingOther) && (
            <div ref={settingsRef}>
              <SettingsPanel
                mode={mode}
                workMin={workMin}
                breakMin={breakMin}
                freeMin={freeMin}
                onChangeWork={onChangeWork}
                onChangeBreak={onChangeBreak}
                onChangeFree={onChangeFree}
                onApply={onApplySettings}
                embedded
              />
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            <FocusGoalPicker
              focusTask={focusTask}
              focusOptions={focusOptions}
              onSelectFocus={onSelectFocus}
              onClearFocus={onClearFocus}
              compact
            />
          </div>

          <TimerControls
            running={running && !viewingOther}
            onToggle={onToggle}
            onReset={onReset}
            size="lg"
          />
        </div>
      </div>
    </div>
  )
}

function readRestoredTimer(settings) {
  const saved = loadPomodoroRuntime()
  if (!saved) return null
  return catchUpTimer({
    now: Date.now(),
    running: !!saved.running,
    mode: saved.mode || 'pomodoro',
    phase: saved.phase || 'work',
    seconds:
      typeof saved.seconds === 'number'
        ? saved.seconds
        : Math.max(1, settings.workMin) * 60,
    endsAt: saved.endsAt || null,
    startedAt: saved.startedAt || null,
    stopwatchOffset: saved.stopwatchOffset || 0,
    settings: {
      ...(saved.settings || settings),
      freeMin: saved.mode === 'free' ? 0 : (saved.settings || settings).freeMin,
    },
  })
}

export function Pomodoro({
  focusTask,
  focusOptions = [],
  onSelectFocus,
  onClearFocus,
  onTrackFocusTime,
}) {
  const { t } = useLocale()
  const [settings, setSettings] = useLocalStorage('focus-timer-settings', {
    workMin: DEFAULT_WORK_MIN,
    breakMin: DEFAULT_BREAK_MIN,
    freeMin: 0,
  })
  const savedWorkMin = Math.max(1, clampMinutes(settings.workMin, DEFAULT_WORK_MIN))
  const savedBreakMin = clampMinutes(settings.breakMin, DEFAULT_BREAK_MIN)

  const restoredRef = useRef(null)
  if (restoredRef.current === null) {
    restoredRef.current = readRestoredTimer({
      ...settings,
      workMin: savedWorkMin,
      breakMin: savedBreakMin,
    })
  }
  const restored = restoredRef.current

  const [mode, setMode] = useState(restored?.mode || 'pomodoro')
  const [sessionMode, setSessionMode] = useState(restored?.mode || 'pomodoro')
  const [phase, setPhase] = useState(restored?.phase || 'work')
  const [seconds, setSeconds] = useState(
    restored?.seconds ?? savedWorkMin * 60,
  )
  /** Длительность текущей фазы — от неё считается наполнение воды. */
  const [liquidTotal, setLiquidTotal] = useState(() => {
    if (typeof restored?.liquidTotal === 'number' && restored.liquidTotal > 0) {
      return restored.liquidTotal
    }
    if (restored?.phase === 'break') {
      return Math.max(1, savedBreakMin * 60)
    }
    return Math.max(1, restored?.seconds ?? savedWorkMin * 60)
  })
  const [finishPulse, setFinishPulse] = useState(false)
  const [running, setRunning] = useState(!!restored?.running)
  const [zenMode, setZenMode] = useState(false)
  const [draftWork, setDraftWork] = useState(String(savedWorkMin))
  const [draftBreak, setDraftBreak] = useState(String(savedBreakMin))
  const [draftFree, setDraftFree] = useState(String(settings.freeMin ?? 0))
  const [sessionActive, setSessionActive] = useState(!!restored?.sessionActive)

  const intervalRef = useRef(null)
  const phaseRef = useRef(phase)
  const settingsRef = useRef(settings)
  const modeRef = useRef(mode)
  const focusIdRef = useRef(focusTask?.id)
  const trackRef = useRef(onTrackFocusTime)
  const secondsRef = useRef(seconds)
  const runningRef = useRef(running)
  const endsAtRef = useRef(restored?.endsAt || null)
  const startedAtRef = useRef(restored?.startedAt || null)
  const stopwatchOffsetRef = useRef(restored?.stopwatchOffset || 0)

  phaseRef.current = phase
  settingsRef.current = settings
  modeRef.current = sessionMode
  focusIdRef.current = focusTask?.id
  trackRef.current = onTrackFocusTime
  secondsRef.current = seconds
  runningRef.current = running

  const isFreeStopwatch = sessionMode === 'free'

  const rebaseLiquid = useCallback((nextSeconds) => {
    setLiquidTotal(Math.max(1, Math.floor(Number(nextSeconds)) || 1))
  }, [])

  const triggerFinishPulse = useCallback(() => {
    setFinishPulse(true)
    window.setTimeout(() => setFinishPulse(false), 800)
  }, [])

  const applyClockState = useCallback(
    (next, { pulse = false } = {}) => {
      if (next.elapsedWork > 0) {
        const focusId = focusIdRef.current
        const track = trackRef.current
        const nextMode = modeRef.current
        const nextPhase = next.phase
        if (
          track &&
          focusId &&
          (nextMode === 'free' || nextPhase === 'work' || phaseRef.current === 'work')
        ) {
          track(focusId, next.elapsedWork)
        }
      }

      const phaseChanged = next.phase !== phaseRef.current
      setSeconds(next.seconds)
      setPhase(next.phase)
      setRunning(next.running)
      setSessionActive(next.sessionActive)
      endsAtRef.current = next.endsAt
      startedAtRef.current = next.startedAt
      stopwatchOffsetRef.current = next.stopwatchOffset
      secondsRef.current = next.seconds
      runningRef.current = next.running
      phaseRef.current = next.phase

      if (phaseChanged && next.seconds > 0) rebaseLiquid(next.seconds)
      if (pulse && next.finished) triggerFinishPulse()
    },
    [rebaseLiquid, triggerFinishPulse],
  )

  const lastSyncAtRef = useRef(0)
  const syncClock = useCallback(
    (options) => {
      const now = Date.now()
      if (now - lastSyncAtRef.current < 250 && !options?.force) {
        return {
          seconds: secondsRef.current,
          phase: phaseRef.current,
          running: runningRef.current,
          sessionActive: runningRef.current,
          endsAt: endsAtRef.current,
          startedAt: startedAtRef.current,
          stopwatchOffset: stopwatchOffsetRef.current,
          elapsedWork: 0,
          finished: false,
        }
      }
      lastSyncAtRef.current = now
      const next = catchUpTimer({
        now,
        running: runningRef.current,
        mode: modeRef.current,
        phase: phaseRef.current,
        seconds: secondsRef.current,
        endsAt: endsAtRef.current,
        startedAt: startedAtRef.current,
        stopwatchOffset: stopwatchOffsetRef.current,
        settings: {
          ...settingsRef.current,
          freeMin: modeRef.current === 'free' ? 0 : settingsRef.current.freeMin,
        },
      })
      applyClockState(next, options)
      return next
    },
    [applyClockState],
  )

  const notificationTitles = useCallback(
    () => ({
      app: t('pomodoro.appTitle'),
      focusDone: t('pomodoro.notify.focusDone'),
      breakDone: t('pomodoro.notify.breakDone'),
      timerDone: t('pomodoro.notify.timerDone'),
    }),
    [t],
  )

  const armNotifications = useCallback(
    (snapshot) => {
      const isStopwatch = snapshot.mode === 'free'
      if (!snapshot.running || isStopwatch || !snapshot.endsAt) {
        cancelTimerNotifications()
        return
      }
      scheduleTimerNotifications({
        endsAt: snapshot.endsAt,
        mode: snapshot.mode,
        phase: snapshot.phase,
        breakMin: settingsRef.current.breakMin,
        titles: notificationTitles(),
      })
    },
    [notificationTitles],
  )

  const commitDraftSettings = () => {
    const nextWork = Math.max(1, clampMinutes(draftWork, settings.workMin))
    const nextBreak = clampMinutes(draftBreak, settings.breakMin)
    const nextFree = clampMinutes(draftFree, settings.freeMin)
    const next = { workMin: nextWork, breakMin: nextBreak, freeMin: nextFree }
    setSettings(next)
    settingsRef.current = next
    setDraftWork(String(nextWork))
    setDraftBreak(String(nextBreak))
    setDraftFree(String(nextFree))
    return next
  }

  const applySettings = () => {
    const next = commitDraftSettings()

    if (running || sessionActive) {
      return next
    }

    endsAtRef.current = null
    startedAtRef.current = null
    cancelTimerNotifications()
    clearPomodoroRuntime()

    if (mode === 'pomodoro') {
      setPhase('work')
      const sec = next.workMin * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    } else {
      setSeconds(0)
      stopwatchOffsetRef.current = 0
    }
    return next
  }

  const reset = () => {
    setRunning(false)
    runningRef.current = false
    setSessionActive(false)
    setSessionMode(mode)
    modeRef.current = mode
    endsAtRef.current = null
    startedAtRef.current = null
    stopwatchOffsetRef.current = 0
    cancelTimerNotifications()
    clearPomodoroRuntime()
    if (mode === 'pomodoro') {
      setPhase('work')
      const sec = Math.max(1, settings.workMin) * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    } else {
      setPhase('work')
      setSeconds(0)
      stopwatchOffsetRef.current = 0
    }
  }

  const startSession = (nextMode) => {
    commitDraftSettings()
    const now = Date.now()
    setSessionMode(nextMode)
    modeRef.current = nextMode
    setPhase('work')
    phaseRef.current = 'work'
    setSessionActive(true)

    if (nextMode === 'free') {
      setSettings((prev) => ({ ...prev, freeMin: 0 }))
      setSeconds(0)
      secondsRef.current = 0
      stopwatchOffsetRef.current = 0
      startedAtRef.current = now
      endsAtRef.current = null
    } else {
      const sec = Math.max(1, settingsRef.current.workMin) * 60
      setSeconds(sec)
      secondsRef.current = sec
      rebaseLiquid(sec)
      stopwatchOffsetRef.current = 0
      startedAtRef.current = null
      endsAtRef.current = now + sec * 1000
    }

    setRunning(true)
    runningRef.current = true
    armNotifications({
      running: true,
      mode: nextMode,
      phase: 'work',
      endsAt: endsAtRef.current,
    })
  }

  const toggleRunning = () => {
    if (mode !== sessionMode) {
      startSession(mode)
      return
    }

    if (running) {
      const snapshot = syncClock()
      setRunning(false)
      runningRef.current = false
      endsAtRef.current = null
      startedAtRef.current = null
      stopwatchOffsetRef.current = snapshot.seconds
      cancelTimerNotifications()
      return
    }

    const nextSettings = commitDraftSettings()
    let startSeconds = seconds
    if (!sessionActive && sessionMode === 'pomodoro' && phase === 'work') {
      startSeconds = Math.max(1, nextSettings.workMin) * 60
      setSeconds(startSeconds)
      secondsRef.current = startSeconds
      rebaseLiquid(startSeconds)
    }

    setSessionActive(true)
    const now = Date.now()
    if (isFreeStopwatch) {
      startedAtRef.current = now
      stopwatchOffsetRef.current = startSeconds
      endsAtRef.current = null
    } else {
      endsAtRef.current = now + Math.max(0, startSeconds) * 1000
      startedAtRef.current = null
    }
    setRunning(true)
    runningRef.current = true
    armNotifications({
      running: true,
      mode: sessionMode,
      phase,
      endsAt: endsAtRef.current,
    })
  }

  const adjustMinutes = (deltaMin) => {
    if (mode !== sessionMode) return
    const deltaSec = deltaMin * 60
    const maxSec = MAX_MINUTES * 60
    const next = Math.max(0, Math.min(maxSec, seconds + deltaSec))
    setSeconds(next)
    secondsRef.current = next
    if (running && !isFreeStopwatch) {
      endsAtRef.current = Date.now() + next * 1000
      armNotifications({
        running: true,
        mode: sessionMode,
        phase,
        endsAt: endsAtRef.current,
      })
    }
    if (running && isFreeStopwatch) {
      stopwatchOffsetRef.current = next
      startedAtRef.current = Date.now()
    }
    if (!isFreeStopwatch && next > 0) {
      rebaseLiquid(next)
    }
    if (!running && !isFreeStopwatch) {
      const minutes = Math.min(MAX_MINUTES, Math.round(next / 60))
      if (phase === 'break') {
        const breakMin = clampMinutes(minutes, settings.breakMin)
        setSettings((prev) => ({ ...prev, breakMin }))
        setDraftBreak(String(breakMin))
      } else {
        const workMin = Math.max(1, clampMinutes(minutes, settings.workMin) || 1)
        setSettings((prev) => ({ ...prev, workMin }))
        setDraftWork(String(workMin))
      }
    }
  }

  const setCustomTime = (totalSeconds) => {
    if (mode !== sessionMode || running) return
    const maxSec = MAX_MINUTES * 60
    const clamped = Math.max(0, Math.min(maxSec, Math.floor(totalSeconds)))
    const minutes = Math.min(MAX_MINUTES, Math.round(clamped / 60))

    setRunning(false)
    runningRef.current = false
    endsAtRef.current = null
    startedAtRef.current = null
    cancelTimerNotifications()
    setSeconds(clamped)
    if (clamped > 0) rebaseLiquid(clamped)

    if (mode === 'free') {
      stopwatchOffsetRef.current = clamped
      return
    }

    if (phase === 'break') {
      setSettings((prev) => ({ ...prev, breakMin: minutes }))
      setDraftBreak(String(minutes))
      return
    }

    const workMin = Math.max(1, minutes || 1)
    setSettings((prev) => ({ ...prev, workMin }))
    setDraftWork(String(workMin))
    if (clamped < 1) {
      const sec = workMin * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    }
  }

  const enterZen = () => {
    setDraftWork(String(Math.max(1, clampMinutes(settings.workMin, DEFAULT_WORK_MIN))))
    setDraftBreak(String(clampMinutes(settings.breakMin, DEFAULT_BREAK_MIN)))
    setDraftFree(String(clampMinutes(settings.freeMin, 0)))
    if (!running && !sessionActive && mode === 'pomodoro' && sessionMode === 'pomodoro') {
      const sec = Math.max(1, clampMinutes(settings.workMin, DEFAULT_WORK_MIN)) * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    }
    setZenMode(true)
  }

  const exitZen = () => {
    applySettings()
    setZenMode(false)
  }

  const switchMode = (nextMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    if (running || sessionActive) return

    setSessionMode(nextMode)
    modeRef.current = nextMode
    setPhase('work')
    if (nextMode === 'pomodoro') {
      const sec = Math.max(1, settings.workMin) * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    } else {
      setSettings((prev) => ({ ...prev, freeMin: 0 }))
      setSeconds(0)
      stopwatchOffsetRef.current = 0
    }
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return undefined
    }

    syncClock({ force: true })
    intervalRef.current = setInterval(() => {
      const prevEnds = endsAtRef.current
      const prevPhase = phaseRef.current
      const next = syncClock({ pulse: true, force: true })
      if (
        next.running &&
        (next.phase !== prevPhase || next.endsAt !== prevEnds)
      ) {
        armNotifications({
          running: true,
          mode: modeRef.current,
          phase: next.phase,
          endsAt: next.endsAt,
        })
      }
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, syncClock, armNotifications])

  useEffect(() => {
    return onAppForeground(() => {
      if (!runningRef.current) return
      const next = syncClock({ pulse: true, force: true })
      armNotifications({
        running: next.running,
        mode: modeRef.current,
        phase: next.phase,
        endsAt: next.endsAt,
      })
    })
  }, [syncClock, armNotifications])

  useEffect(() => {
    if (!running && !sessionActive) {
      clearPomodoroRuntime()
      return
    }
    savePomodoroRuntime({
      running,
      sessionActive,
      mode: sessionMode,
      phase,
      seconds,
      liquidTotal,
      endsAt: endsAtRef.current,
      startedAt: startedAtRef.current,
      stopwatchOffset: stopwatchOffsetRef.current,
      settings,
    })
  }, [running, sessionActive, sessionMode, phase, seconds, liquidTotal, settings])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const nextWork = Math.max(1, clampMinutes(draftWork, DEFAULT_WORK_MIN))
      const nextBreak = clampMinutes(draftBreak, DEFAULT_BREAK_MIN)
      const nextFree = clampMinutes(draftFree, 0)
      setSettings((prev) => {
        if (
          prev.workMin === nextWork &&
          prev.breakMin === nextBreak &&
          prev.freeMin === nextFree
        ) {
          return prev
        }
        return { workMin: nextWork, breakMin: nextBreak, freeMin: nextFree }
      })
    }, 350)
    return () => window.clearTimeout(id)
  }, [draftWork, draftBreak, draftFree, setSettings])

  useEffect(() => {
    if (running || sessionActive) return
    if (mode !== 'pomodoro' || sessionMode !== 'pomodoro') return
    const sec = Math.max(1, clampMinutes(settings.workMin, DEFAULT_WORK_MIN)) * 60
    setSeconds(sec)
    rebaseLiquid(sec)
  }, [
    settings.workMin,
    running,
    sessionActive,
    mode,
    sessionMode,
    rebaseLiquid,
  ])

  useEffect(() => {
    if (!focusTask) return
    setDraftWork(String(settings.workMin))
    setDraftBreak(String(settings.breakMin))
    setDraftFree(String(settings.freeMin))
    setZenMode(true)
  }, [focusTask?.id])

  useEffect(() => {
    if (running || sessionActive) {
      const label =
        sessionMode === 'pomodoro'
          ? phase === 'break'
            ? t('pomodoro.status.break')
            : t('pomodoro.status.focus')
          : t('pomodoro.status.free')
      document.title = `${formatTime(seconds)} · ${label}`
    } else {
      document.title = t('pomodoro.appTitle')
    }

    return () => {
      document.title = t('pomodoro.appTitle')
    }
  }, [seconds, running, sessionActive, mode, phase, t])

  const showLive = running || sessionActive
  const liquidLevel =
    sessionMode !== 'pomodoro'
      ? 0
      : (() => {
          const total = Math.max(1, liquidTotal)
          const remaining = Math.min(total, Math.max(0, seconds))
          if (phase === 'break') {
            return Math.min(100, Math.max(0, (remaining / total) * 100))
          }
          return Math.min(100, Math.max(0, (1 - remaining / total) * 100))
        })()

  const optionsWithCurrent = focusTask
    ? focusOptions.some((t) => t.id === focusTask.id)
      ? focusOptions
      : [focusTask, ...focusOptions]
    : focusOptions

  if (zenMode) {
    return (
      <ZenMode
        seconds={seconds}
        mode={mode}
        sessionMode={sessionMode}
        phase={phase}
        running={running}
        showLive={showLive}
        liquidLevel={liquidLevel}
        finishPulse={finishPulse}
        focusTask={focusTask}
        focusOptions={optionsWithCurrent}
        onSelectFocus={onSelectFocus}
        onClearFocus={onClearFocus}
        onSwitchMode={switchMode}
        onClose={exitZen}
        onToggle={toggleRunning}
        onReset={reset}
        onAdjust={adjustMinutes}
        onSetCustomTime={setCustomTime}
        workMin={draftWork}
        breakMin={draftBreak}
        freeMin={draftFree}
        onChangeWork={setDraftWork}
        onChangeBreak={setDraftBreak}
        onChangeFree={setDraftFree}
        onApplySettings={applySettings}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={enterZen}
      className="pomodoro-fab fixed z-50 flex h-[3.675rem] w-[3.675rem] items-center justify-center rounded-xl border border-black/[0.06] dark:border-zinc-700 bg-surface dark:bg-zinc-900/95 text-ink-soft dark:text-zinc-100 shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_-16px_rgba(24,24,27,0.55)] backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
      aria-label={t('pomodoro.open')}
    >
      <Timer size={21} strokeWidth={1.75} />
      {showLive && (
        <span className="absolute -top-0.5 -right-0.5">
          <LiveIndicator running={running} />
        </span>
      )}
    </button>
  )
}
