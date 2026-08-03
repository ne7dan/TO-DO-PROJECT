import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import {
  Maximize2,
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

/** Уровень «жидкости» 0–100 (оставшееся время относительно текущей базы). */
function LiquidFill({ level, finishing = false }) {
  const clamped = Math.min(100, Math.max(0, level))
  const waveId = useId().replace(/:/g, '')

  return (
    <div
      className={[
        'pointer-events-none absolute inset-0 overflow-hidden rounded-xl',
        finishing ? 'animate-liquid-finish' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    >
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-1000 linear"
        style={{ height: `${clamped}%` }}
      >
        <svg
          className="animate-liquid-wave absolute -top-3 left-0 h-4 w-[200%] text-[var(--accent-muted)] opacity-70"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`liq-${waveId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#liq-${waveId})`}
            d="M0 20 Q150 0 300 20 T600 20 T900 20 T1200 20 V40 H0 Z"
          />
          <path
            fill="currentColor"
            opacity="0.35"
            d="M0 22 Q150 38 300 22 T600 22 T900 22 T1200 22 V40 H0 Z"
          />
        </svg>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, color-mix(in srgb, var(--accent-muted) 35%, transparent), color-mix(in srgb, var(--accent-color) 18%, transparent), color-mix(in srgb, var(--accent-hover) 28%, transparent))',
          }}
        />
      </div>
      {finishing && (
        <div
          className="absolute inset-0 animate-liquid-finish-ring"
          style={{
            background:
              'radial-gradient(circle at center, var(--accent-glow) 0%, transparent 65%)',
          }}
        />
      )}
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
        onChange={(e) => setDraft(e.target.value)}
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
        className={inputClassName}
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
  phase,
  running,
  showLive,
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

  const revealControls = useCallback((sticky = false) => {
    setControlsVisible(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (sticky) return
    idleTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, CONTROLS_IDLE_MS)
  }, [])

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
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') {
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
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT')
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

  const status = getZenStatus(mode, phase, t)
  const focusLabel = focusTask ? displayTodoText(focusTask.text) : ''
  const showControls = controlsVisible || inputFocused

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fade-in"
      onMouseMove={() => revealControls(inputFocused)}
      onTouchStart={() => revealControls(inputFocused)}
      role="dialog"
      aria-modal="true"
      aria-label={t('pomodoro.zen')}
      style={{ ['--keyboard-inset']: `${keyboardInset}px` }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('pomodoro.zenCollapse')}
        className={[
          'absolute right-[max(1rem,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+1.75rem)] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white/80 text-zinc-600 backdrop-blur transition-opacity duration-500 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <Minimize2 size={18} />
      </button>

      <div
        ref={scrollRef}
        className="zen-scroll flex h-full w-full max-w-xl flex-col items-center overflow-y-auto overscroll-contain px-6 py-[max(5rem,calc(env(safe-area-inset-top)+4rem))]"
        style={{
          paddingBottom: `calc(max(2rem, env(safe-area-inset-bottom, 0px)) + var(--keyboard-inset, 0px) + 1.5rem)`,
        }}
      >
        <div className="mb-6 flex w-full items-center justify-center sm:mb-8">
          <div className="flex items-center gap-2.5">
            <p className="font-display text-xs uppercase tracking-[0.28em] text-zinc-400 sm:text-sm">
              {status}
            </p>
            {showLive && <LiveIndicator running={running} size="lg" />}
          </div>
        </div>

        <EditableTimeDisplay
          seconds={seconds}
          running={running}
          onCommit={onSetCustomTime}
          editOnSingleTap
          className={[
            'font-customMono font-bold tabular-nums tracking-tight leading-none text-[clamp(4.5rem,18vw,9.5rem)] text-zinc-900 dark:text-zinc-50 select-none',
            running ? 'cursor-default' : 'cursor-text',
          ].join(' ')}
          inputClassName="w-full max-w-md text-center bg-transparent border-b-2 border-zinc-300 dark:border-zinc-600 outline-none font-customMono font-bold tabular-nums tracking-tight leading-none text-[clamp(3rem,14vw,7rem)] text-zinc-900 dark:text-zinc-50"
        />

        <div
          className={[
            'mt-6 flex justify-center transition-opacity duration-500',
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
          ].join(' ')}
        >
          <AdjustButtons onAdjust={onAdjust} size="lg" />
        </div>

        {focusLabel && (
          <p className="mt-6 max-w-xl truncate text-center text-lg text-zinc-400 sm:text-xl">
            {focusLabel}
          </p>
        )}

        <div
          className={[
            'mt-8 w-full space-y-4 transition-opacity duration-500 sm:mt-12',
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
          ].join(' ')}
        >
          <ModeToggle mode={mode} onChange={onSwitchMode} />

          {!running && (
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
            running={running}
            onToggle={onToggle}
            onReset={onReset}
            size="lg"
          />
        </div>
      </div>
    </div>
  )
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

  const [mode, setMode] = useState('pomodoro')
  const [phase, setPhase] = useState('work')
  const [seconds, setSeconds] = useState(DEFAULT_WORK_MIN * 60)
  /** База для «воды»: при ручной смене времени пересчитывается, чтобы уровень оставался полным. */
  const [liquidTotal, setLiquidTotal] = useState(DEFAULT_WORK_MIN * 60)
  const [finishPulse, setFinishPulse] = useState(false)
  const [running, setRunning] = useState(false)
  // На мобильных панель свёрнута; на ПК — открыта (без реакции на resize)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  const [zenMode, setZenMode] = useState(false)
  const [draftWork, setDraftWork] = useState(String(DEFAULT_WORK_MIN))
  const [draftBreak, setDraftBreak] = useState(String(DEFAULT_BREAK_MIN))
  const [draftFree, setDraftFree] = useState('0')
  const [sessionActive, setSessionActive] = useState(false)

  const intervalRef = useRef(null)
  const phaseRef = useRef(phase)
  const settingsRef = useRef(settings)
  const modeRef = useRef(mode)
  const focusIdRef = useRef(focusTask?.id)
  const trackRef = useRef(onTrackFocusTime)

  phaseRef.current = phase
  settingsRef.current = settings
  modeRef.current = mode
  focusIdRef.current = focusTask?.id
  trackRef.current = onTrackFocusTime

  const freeCountdown = Math.max(0, settings.freeMin) * 60
  const isFreeStopwatch = mode === 'free' && freeCountdown === 0

  const rebaseLiquid = useCallback((nextSeconds) => {
    setLiquidTotal(Math.max(1, Math.floor(Number(nextSeconds)) || 1))
  }, [])

  const triggerFinishPulse = useCallback(() => {
    setFinishPulse(true)
    window.setTimeout(() => setFinishPulse(false), 800)
  }, [])

  const applySettings = () => {
    const nextWork = Math.max(1, clampMinutes(draftWork, settings.workMin))
    const nextBreak = clampMinutes(draftBreak, settings.breakMin)
    const nextFree = clampMinutes(draftFree, settings.freeMin)

    const next = { workMin: nextWork, breakMin: nextBreak, freeMin: nextFree }
    setSettings(next)
    setRunning(false)
    setSessionActive(false)

    if (mode === 'pomodoro') {
      setPhase('work')
      const sec = nextWork * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    } else {
      const sec = nextFree * 60
      setSeconds(sec)
      if (sec > 0) rebaseLiquid(sec)
    }
  }

  const reset = () => {
    setRunning(false)
    setSessionActive(false)
    if (mode === 'pomodoro') {
      setPhase('work')
      const sec = Math.max(1, settings.workMin) * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    } else {
      const sec = Math.max(0, settings.freeMin) * 60
      setSeconds(sec)
      if (sec > 0) rebaseLiquid(sec)
    }
  }

  const toggleRunning = () => {
    setSessionActive(true)
    setRunning((v) => !v)
  }

  const adjustMinutes = (deltaMin) => {
    const deltaSec = deltaMin * 60
    const maxSec = MAX_MINUTES * 60
    const next = Math.max(0, Math.min(maxSec, seconds + deltaSec))
    setSeconds(next)
    // Ручная смена = новая база «воды», уровень остаётся полным
    if (!(mode === 'free' && settings.freeMin === 0) && next > 0) {
      rebaseLiquid(next)
    }
  }

  const setCustomTime = (totalSeconds) => {
    const maxSec = MAX_MINUTES * 60
    const clamped = Math.max(0, Math.min(maxSec, Math.floor(totalSeconds)))
    const minutes = Math.min(MAX_MINUTES, Math.round(clamped / 60))

    setRunning(false)
    setSeconds(clamped)
    if (clamped > 0) rebaseLiquid(clamped)

    if (mode === 'free') {
      setSettings((prev) => ({ ...prev, freeMin: minutes }))
      return
    }

    if (phase === 'break') {
      setSettings((prev) => ({ ...prev, breakMin: minutes }))
      return
    }

    const workMin = Math.max(1, minutes || 1)
    setSettings((prev) => ({ ...prev, workMin }))
    if (clamped < 1) {
      const sec = workMin * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    }
  }

  const enterZen = () => {
    setCollapsed(false)
    setDraftWork(String(settings.workMin))
    setDraftBreak(String(settings.breakMin))
    setDraftFree(String(settings.freeMin))
    setZenMode(true)
  }

  const exitZen = useCallback(() => {
    setZenMode(false)
  }, [])

  const switchMode = (nextMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    setRunning(false)
    setSessionActive(false)
    setPhase('work')
    if (nextMode === 'pomodoro') {
      const sec = Math.max(1, settings.workMin) * 60
      setSeconds(sec)
      rebaseLiquid(sec)
    } else {
      const sec = Math.max(0, settings.freeMin) * 60
      setSeconds(sec)
      if (sec > 0) rebaseLiquid(sec)
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

    intervalRef.current = setInterval(() => {
      const currentMode = modeRef.current
      const currentSettings = settingsRef.current
      const currentPhase = phaseRef.current
      const focusId = focusIdRef.current
      const track = trackRef.current

      if (
        track &&
        focusId &&
        (currentMode === 'free' || currentPhase === 'work')
      ) {
        track(focusId, 1)
      }

      if (currentMode === 'free' && currentSettings.freeMin === 0) {
        setSeconds((prev) => prev + 1)
        return
      }

      setSeconds((prev) => {
        if (prev <= 1) {
          triggerFinishPulse()

          if (currentMode === 'pomodoro') {
            const nextPhase = phaseRef.current === 'work' ? 'break' : 'work'
            const nextSeconds =
              nextPhase === 'work'
                ? Math.max(1, currentSettings.workMin) * 60
                : Math.max(0, currentSettings.breakMin) * 60

            if (nextPhase === 'break' && currentSettings.breakMin === 0) {
              setPhase('work')
              setRunning(false)
              setSessionActive(false)
              const sec = Math.max(1, currentSettings.workMin) * 60
              rebaseLiquid(sec)
              return sec
            }

            setPhase(nextPhase)
            if (nextPhase === 'work') {
              setRunning(false)
              setSessionActive(false)
            }
            const sec =
              nextSeconds || Math.max(1, currentSettings.workMin) * 60
            if (sec > 0) rebaseLiquid(sec)
            return sec
          }

          setRunning(false)
          setSessionActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, rebaseLiquid, triggerFinishPulse])

  useEffect(() => {
    if (!focusTask) return
    setCollapsed(false)
  }, [focusTask?.id])

  useEffect(() => {
    if (running || sessionActive) {
      const label =
        mode === 'pomodoro'
          ? phase === 'break'
            ? t('pomodoro.status.break')
            : t('pomodoro.status.focus')
          : t('pomodoro.status.focus')
      document.title = `${formatTime(seconds)} · ${label}`
    } else {
      document.title = t('pomodoro.appTitle')
    }

    return () => {
      document.title = t('pomodoro.appTitle')
    }
  }, [seconds, running, sessionActive, mode, phase, t])

  // Уровень воды = остаток / текущая база (после ручной правки база = новое значение)
  const liquidLevel = isFreeStopwatch
    ? 0
    : Math.min(100, Math.max(0, (seconds / Math.max(1, liquidTotal)) * 100))

  const subtitle = focusTask
    ? displayTodoText(focusTask.text)
    : mode === 'pomodoro'
      ? phase === 'break'
        ? t('pomodoro.subtitle.break', { n: settings.breakMin })
        : t('pomodoro.subtitle.work', { n: settings.workMin })
      : settings.freeMin > 0
        ? t('pomodoro.subtitle.free', { n: settings.freeMin })
        : t('pomodoro.subtitle.stopwatch')

  const showLive = running || sessionActive

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
        phase={phase}
        running={running}
        showLive={showLive}
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

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
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

  return (
    <div className="pomodoro-panel fixed z-50 w-full overflow-hidden border border-black/[0.06] dark:border-zinc-700/90 bg-surface dark:bg-zinc-900/95 backdrop-blur-md shadow-[0_-8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.65)] animate-slide-up">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, color-mix(in srgb, var(--accent-soft) 85%, transparent), transparent)',
        }}
      />

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {t('pomodoro.focusMode')}
              </p>
              {showLive && <LiveIndicator running={running} />}
            </div>
            <p className="font-display text-sm font-semibold truncate mt-0.5 text-zinc-900 dark:text-zinc-100">
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={enterZen}
              aria-label={t('pomodoro.zenFull')}
              title={t('pomodoro.zen')}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t('pomodoro.collapse')}
              className="btn-danger-hover p-1.5 rounded-md text-zinc-500"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <ModeToggle mode={mode} onChange={switchMode} />

        <div className="mt-3 hidden sm:block rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 px-2.5 py-2">
          <FocusGoalPicker
            focusTask={focusTask}
            focusOptions={optionsWithCurrent}
            onSelectFocus={onSelectFocus}
            onClearFocus={onClearFocus}
            compact
          />
        </div>

        <div className="relative mt-3 mb-1 overflow-hidden rounded-xl border border-black/[0.05] dark:border-zinc-800 bg-gradient-to-b from-canvas-warm to-surface dark:from-zinc-950/80 dark:to-zinc-900/40 px-3 pt-3 pb-3.5">
          {!isFreeStopwatch && (
            <LiquidFill level={liquidLevel} finishing={finishPulse} />
          )}

          <div className="relative z-[1]">
            <EditableTimeDisplay
              seconds={seconds}
              running={running}
              onCommit={setCustomTime}
              className={[
                'w-full text-center font-customMono text-[2.65rem] leading-none font-bold tabular-nums tracking-tight transition-colors',
                running
                  ? 'text-zinc-900 dark:text-zinc-50 cursor-default'
                  : 'text-zinc-800 dark:text-zinc-100 hover:text-zinc-950 dark:hover:text-white cursor-text',
              ].join(' ')}
              inputClassName="w-full text-center font-customMono text-[2.65rem] leading-none font-bold tabular-nums tracking-tight bg-transparent border-b border-zinc-300 dark:border-zinc-600 outline-none text-zinc-900 dark:text-zinc-100 py-0.5"
            />

            <div className="mt-3.5 flex justify-center">
              <AdjustButtons onAdjust={adjustMinutes} />
            </div>
          </div>
        </div>

        <div className="mt-3.5">
          <TimerControls
            running={running}
            onToggle={toggleRunning}
            onReset={reset}
          />
        </div>
      </div>
    </div>
  )
}
