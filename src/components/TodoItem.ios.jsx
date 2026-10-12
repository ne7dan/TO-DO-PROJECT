import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  Focus,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { displayTodoText, MAX_TODO_TEXT_LENGTH } from '../utils/text'
import { parseDateKey, toDateKey } from '../utils/dates'
import {
  formatEstimate,
  formatTracked,
  normalizeEstimateMinutes,
} from '../utils/estimate'
import { normalizePriority } from '../utils/todoMeta'
import { useLocale } from '../i18n/LocaleContext'
import { MetaBadge, MetaPicker } from './MetaChips'
import { TODO_DRAG_TYPE, touchTodoDrag } from '../hooks/useTodos'
import {
  clearReminderTime,
  daysInMonth,
  getReminder,
  getReminderTime,
  setReminder,
  syncTodoReminder,
} from '../lib/goalReminders.ios'

const MENU_ITEM_CLASS =
  'flex min-h-[3.05rem] w-full items-center gap-3 px-4 py-[0.9rem] text-left text-[16px] leading-snug text-ink hover:bg-canvas-warm dark:text-zinc-100 dark:hover:bg-zinc-800'
const MENU_ESTIMATE_H = 340

function RemindSelect({ value, onChange, ariaLabel, face, children }) {
  return (
    <div className="todo-remind-select-wrap">
      <span className="todo-remind-select-face" aria-hidden>
        {face}
      </span>
      <select
        value={value}
        onChange={onChange}
        className="todo-remind-select-native"
        aria-label={ariaLabel}
      >
        {children}
      </select>
    </div>
  )
}

function formatRemindStamp(todo, reminder, t) {
  if (!reminder?.time) return ''
  if (todo.period === 'week' && reminder.weekday) {
    const days = t('calendar.weekdays').split(',')
    return `${reminder.time} · ${days[reminder.weekday - 1] ?? ''}`
  }
  if (todo.period === 'month' && reminder.monthDay) {
    return `${reminder.time} · ${reminder.monthDay}`
  }
  if (todo.period === 'year' && reminder.month && reminder.monthDay) {
    return `${reminder.monthDay}.${String(reminder.month).padStart(2, '0')} · ${reminder.time}`
  }
  return reminder.time
}

function defaultRemindDraft(todo) {
  const existing = getReminder(todo.id)
  const start = todo.date ? parseDateKey(todo.date) : new Date()
  const last = daysInMonth(start.getFullYear(), start.getMonth())
  return {
    time: existing?.time || '21:00',
    weekday: existing?.weekday ?? 7,
    monthDay: existing?.monthDay ?? last,
    month: existing?.month ?? 12,
  }
}

export function TodoItem({
  todo,
  onToggle,
  onUpdate,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFocus,
  onReorder,
  showSubtasksHint,
}) {
  const { t, locale, localeTag } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const [subtaskText, setSubtaskText] = useState('')
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const [remindOpen, setRemindOpen] = useState(false)
  const [remindDraft, setRemindDraft] = useState({
    time: '21:00',
    weekday: 7,
    monthDay: 1,
    month: 12,
  })
  const [remindError, setRemindError] = useState(null)
  const [remindSaving, setRemindSaving] = useState(false)
  const [reminderTick, setReminderTick] = useState(0)
  const reminderTime = getReminderTime(todo.id)
  void reminderTick
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [draftText, setDraftText] = useState(todo.text)
  const [draftPriority, setDraftPriority] = useState(
    normalizePriority(todo.priority),
  )
  const editInputRef = useRef(null)
  const editMenuRef = useRef(null)
  const editButtonRef = useRef(null)
  const frontRef = useRef(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const wasCompletedRef = useRef(todo.completed)

  const doneSubtasks = todo.subtasks.filter((s) => s.completed).length
  const hasSubtasks = todo.subtasks.length > 0
  const priority = normalizePriority(todo.priority)
  const estimated = normalizeEstimateMinutes(todo.estimatedMinutes)
  const spent = Math.max(0, Math.floor(todo.spentSeconds || 0))
  const showMetaRow =
    !editing &&
    (todo.habitId ||
      priority !== 'none' ||
      estimated > 0 ||
      spent > 0 ||
      hasSubtasks ||
      (showSubtasksHint && expanded))

  useEffect(() => {
    if (!editing) return undefined
    editInputRef.current?.focus()
    editInputRef.current?.select()
    return undefined
  }, [editing])

  useEffect(() => {
    if (!editMenuOpen) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setEditMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editMenuOpen])

  useLayoutEffect(() => {
    if (!editMenuOpen) return undefined

    const updatePos = () => {
      const btn = editButtonRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const below = rect.bottom + 8
      const flip = below + MENU_ESTIMATE_H > window.innerHeight - 12
      setMenuPos({
        top: flip
          ? Math.max(12, rect.top - MENU_ESTIMATE_H)
          : below,
        right: Math.max(12, window.innerWidth - rect.right),
      })
    }

    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [editMenuOpen])

  useEffect(() => {
    if (editing) setEditMenuOpen(false)
  }, [editing])

  useEffect(() => {
    const becameDone = todo.completed && !wasCompletedRef.current
    wasCompletedRef.current = todo.completed
    if (!becameDone) return undefined
    setJustCompleted(true)
    const id = window.setTimeout(() => setJustCompleted(false), 360)
    return () => window.clearTimeout(id)
  }, [todo.completed])

  const clearTouchDragVisual = () => {
    document.querySelectorAll('[data-todo-drop].touch-drag-over').forEach((el) => {
      el.classList.remove('touch-drag-over')
    })
    document.querySelectorAll('[data-cal-drop].touch-drag-over').forEach((el) => {
      el.classList.remove('touch-drag-over')
    })
  }

  const finishTouchDrag = useCallback(
    (point) => {
      const el = point
        ? document.elementFromPoint(point.clientX, point.clientY)
        : null
      const overTodo = el?.closest('[data-todo-drop]')
      const overCal = el?.closest('[data-cal-drop]')
      const sourceId = touchTodoDrag.id

      clearTouchDragVisual()
      touchTodoDrag.id = null
      setDragging(false)
      setDragOver(false)

      if (!sourceId) return
      if (overTodo) {
        const targetId = overTodo.getAttribute('data-todo-drop')
        if (targetId && targetId !== sourceId) onReorder?.(sourceId, targetId)
        return
      }
      if (overCal) {
        const dateKey = overCal.getAttribute('data-cal-drop')
        if (dateKey) {
          window.dispatchEvent(
            new CustomEvent('todo-touch-calendar-drop', {
              detail: { id: sourceId, dateKey },
            }),
          )
        }
      }
    },
    [onReorder],
  )

  useEffect(() => {
    const node = frontRef.current
    if (!node || editing) return undefined

    const SWIPE_MAX = 112
    const SWIPE_COMMIT = 64
    const LONG_PRESS_MS = 430
    const AXIS = 12

    const offset = { current: 0 }
    const mode = { current: 'idle' }
    const start = { x: 0, y: 0 }
    let longPressTimer = 0

    const setOffset = (px, animate) => {
      offset.current = px
      node.style.transition = animate ? 'transform 0.22s ease' : 'none'
      node.style.transform = `translate3d(${px}px,0,0)`
    }

    const clearLongPress = () => {
      if (longPressTimer) {
        window.clearTimeout(longPressTimer)
        longPressTimer = 0
      }
    }

    const onStart = (e) => {
      if (e.touches.length !== 1) return
      const target = e.target
      if (
        target instanceof Element &&
        target.closest('button, input, textarea, a, [role="menu"]')
      ) {
        mode.current = 'control'
        return
      }
      const touch = e.touches[0]
      start.x = touch.clientX
      start.y = touch.clientY
      mode.current = 'pending'
      setOffset(0, false)

      longPressTimer = window.setTimeout(() => {
        mode.current = 'drag'
        touchTodoDrag.id = todo.id
        setDragging(true)
        try {
          navigator.vibrate?.(12)
        } catch {
          /* iOS may ignore */
        }
      }, LONG_PRESS_MS)
    }

    const onMove = (e) => {
      const touch = e.touches[0]
      if (!touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y

      if (mode.current === 'drag') {
        e.preventDefault()
        clearTouchDragVisual()
        const el = document.elementFromPoint(touch.clientX, touch.clientY)
        const overTodo = el?.closest('[data-todo-drop]')
        const overCal = el?.closest('[data-cal-drop]')
        if (overTodo && overTodo.getAttribute('data-todo-drop') !== todo.id) {
          overTodo.classList.add('touch-drag-over')
        } else if (overCal) {
          overCal.classList.add('touch-drag-over')
        }
        return
      }

      if (mode.current === 'pending') {
        if (Math.abs(dy) > AXIS && Math.abs(dy) > Math.abs(dx)) {
          clearLongPress()
          mode.current = 'scroll'
          return
        }
        if (Math.abs(dx) > AXIS && Math.abs(dx) > Math.abs(dy)) {
          clearLongPress()
          mode.current = 'swipe'
        }
      }

      if (mode.current === 'swipe') {
        e.preventDefault()
        const next = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx))
        setOffset(next, false)
      }
    }

    const onEnd = (e) => {
      clearLongPress()
      const dx = offset.current

      if (mode.current === 'drag') {
        finishTouchDrag(e.changedTouches?.[0])
        mode.current = 'idle'
        setOffset(0, true)
        return
      }

      if (mode.current === 'swipe') {
        if (dx >= SWIPE_COMMIT) {
          setOffset(0, true)
          onToggle(todo.id)
        } else if (dx <= -SWIPE_COMMIT) {
          setOffset(-Math.min(window.innerWidth, 420), true)
          window.setTimeout(() => {
            setRemoving(true)
            window.setTimeout(() => onDelete(todo.id), 220)
          }, 80)
        } else {
          setOffset(0, true)
        }
      }

      mode.current = 'idle'
    }

    node.addEventListener('touchstart', onStart, { passive: true })
    node.addEventListener('touchmove', onMove, { passive: false })
    node.addEventListener('touchend', onEnd)
    node.addEventListener('touchcancel', onEnd)
    return () => {
      clearLongPress()
      node.removeEventListener('touchstart', onStart)
      node.removeEventListener('touchmove', onMove)
      node.removeEventListener('touchend', onEnd)
      node.removeEventListener('touchcancel', onEnd)
    }
  }, [editing, finishTouchDrag, onDelete, onToggle, todo.id])

  const startEdit = () => {
    setDraftText(todo.text)
    setDraftPriority(normalizePriority(todo.priority))
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraftText(todo.text)
    setDraftPriority(normalizePriority(todo.priority))
  }

  const saveEdit = () => {
    if (!draftText.trim()) return
    onUpdate(todo.id, {
      text: draftText,
      priority: draftPriority,
    })
    setEditing(false)
  }

  const handleDelete = () => {
    setRemoving(true)
    window.setTimeout(() => onDelete(todo.id), 220)
  }

  const closeRemind = () => {
    setRemindOpen(false)
    setRemindError(null)
  }

  const saveReminder = async () => {
    setRemindSaving(true)
    setRemindError(null)
    const saved = setReminder(todo.id, remindDraft)
    if (!saved) {
      setRemindSaving(false)
      return
    }
    const result = await syncTodoReminder(todo, {
      title: t('pomodoro.appTitle'),
      body: `${t('todo.remind')}: ${displayTodoText(todo.text)}`,
    })
    setRemindSaving(false)
    if (!result.ok && result.error === 'permission') {
      setRemindError(t('todo.remindNeedPermission'))
      return
    }
    setReminderTick((n) => n + 1)
    closeRemind()
  }

  const removeReminder = async () => {
    setRemindSaving(true)
    clearReminderTime(todo.id)
    await syncTodoReminder({ ...todo, completed: true }, {})
    setRemindSaving(false)
    setReminderTick((n) => n + 1)
    closeRemind()
  }

  const handleAddSubtask = (e) => {
    e.preventDefault()
    if (!subtaskText.trim()) return
    onAddSubtask(todo.id, subtaskText)
    setSubtaskText('')
    setExpanded(true)
  }

  return (
    <>
    <li
      data-todo-drop={todo.id}
      title={t('todo.longPressToMove')}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const id =
          e.dataTransfer.getData(TODO_DRAG_TYPE) ||
          e.dataTransfer.getData('text/plain')
        if (id) onReorder?.(id, todo.id)
      }}
      className={[
        'group todo-row todo-swipe',
        dragOver ? 'is-drag-over' : '',
        dragging ? 'is-dragging opacity-80' : '',
        removing ? 'animate-removing' : 'animate-todo-enter',
      ].join(' ')}
    >
      <div className="todo-swipe__actions" aria-hidden>
        <div className="todo-swipe__complete">
          <Check size={18} strokeWidth={2.4} />
        </div>
        <div className="todo-swipe__delete">
          <Trash2 size={18} strokeWidth={2} />
        </div>
      </div>

      <div ref={frontRef} className="todo-swipe__front space-y-1.5 py-3.5 pl-3 pr-1.5">
        {/* Строка задачи: текст по центру с чекбоксом */}
        <div className="flex items-start gap-1">
          <button
            type="button"
            onPointerUp={(e) => {
              if (e.pointerType === 'touch') e.preventDefault()
              onToggle(todo.id)
            }}
            onClick={(e) => {
              if (e.detail === 0) return
              onToggle(todo.id)
            }}
            aria-label={
              todo.completed ? t('todo.uncomplete') : t('todo.complete')
            }
            className={[
              'todo-check touch-target flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200',
              todo.completed
                ? 'text-[var(--accent-contrast)]'
                : 'text-transparent',
              justCompleted ? 'animate-todo-complete' : '',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-200',
                todo.completed
                  ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-[var(--accent-contrast)]'
                  : 'border-black/20 dark:border-[var(--border-color)] hover:border-[var(--accent-color)] active:border-[var(--accent-color)]',
              ].join(' ')}
            >
              {todo.completed ? (
                <Check size={14} strokeWidth={2.5} />
              ) : (
                <Circle size={14} strokeWidth={1.5} className="opacity-0" />
              )}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-2.5">
                <input
                  ref={editInputRef}
                  type="text"
                  value={draftText}
                  onChange={(e) =>
                    setDraftText(e.target.value.slice(0, MAX_TODO_TEXT_LENGTH))
                  }
                  maxLength={MAX_TODO_TEXT_LENGTH}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      saveEdit()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelEdit()
                    }
                  }}
                  className="w-full rounded-xl border border-black/[0.08] dark:border-[var(--border-color)] bg-surface dark:bg-[var(--bg-card)] px-3 py-2 text-[16.05px] text-ink dark:text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-glow)]"
                />
                <MetaPicker
                  priority={draftPriority}
                  onPriorityChange={setDraftPriority}
                  t={t}
                  compact
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D3142] dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-medium hover:opacity-90"
                  >
                    <CheckCheck size={13} strokeWidth={2} />
                    {t('todo.save')}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-1 rounded-xl border border-black/[0.08] dark:border-zinc-600 px-3 py-1.5 text-xs text-muted dark:text-zinc-300 hover:bg-canvas-warm dark:hover:bg-zinc-800"
                  >
                    {t('todo.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-start gap-1.5">
                <p className="min-w-0 flex-1 pt-2.5 text-left text-[17.5px] leading-snug break-words whitespace-normal">
                  <span
                    className={[
                      'todo-strike transition-colors',
                      todo.completed
                        ? 'is-done text-muted/70 dark:text-zinc-500'
                        : 'text-ink dark:text-zinc-50',
                    ].join(' ')}
                  >
                    {displayTodoText(todo.text)}
                  </span>
                </p>

                <div className="relative flex shrink-0 items-center gap-0.5">
                  <button
                    ref={editButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditMenuOpen((open) => !open)
                    }}
                    aria-label={t('todo.edit')}
                    aria-expanded={editMenuOpen}
                    aria-haspopup="menu"
                    title={t('todo.edit')}
                    className="touch-target flex items-center justify-center rounded-xl hover:bg-black/[0.04] dark:hover:bg-zinc-800 active:bg-black/[0.06] dark:active:bg-zinc-800 text-muted dark:text-zinc-300"
                  >
                    <Pencil size={16} strokeWidth={1.75} />
                  </button>

                  {editMenuOpen &&
                    createPortal(
                      <>
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={t('todo.cancel')}
                          className="fixed inset-0 z-[200] border-0 bg-black/45 backdrop-blur-[1px] animate-fade-in"
                          onPointerDown={(e) => {
                            // preventDefault — чтобы клик не «пробил» на кнопку карандаша и не открыл меню снова
                            e.preventDefault()
                            e.stopPropagation()
                            setEditMenuOpen(false)
                          }}
                        />
                        <div
                          ref={editMenuRef}
                          role="menu"
                          style={{ top: menuPos.top, right: menuPos.right }}
                          className="fixed z-[210] w-[min(17.25rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-black/[0.08] bg-surface py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.28)] animate-fade-in dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setEditMenuOpen(false)
                              startEdit()
                            }}
                            className={MENU_ITEM_CLASS}
                          >
                            <Pencil
                              size={18}
                              strokeWidth={1.75}
                              className="shrink-0 opacity-70"
                            />
                            {t('todo.edit')}
                          </button>

                          {!todo.completed && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setEditMenuOpen(false)
                                setRemindError(null)
                                setRemindDraft(defaultRemindDraft(todo))
                                setRemindOpen(true)
                              }}
                              className={MENU_ITEM_CLASS}
                            >
                              <Bell
                                size={18}
                                strokeWidth={1.75}
                                className="shrink-0 opacity-70"
                              />
                              {reminderTime
                                ? t('todo.remindAt', {
                                    time: formatRemindStamp(
                                      todo,
                                      getReminder(todo.id),
                                      t,
                                    ),
                                  })
                                : t('todo.remind')}
                            </button>
                          )}

                          {!todo.completed &&
                            todo.period === 'day' &&
                            todo.date === toDateKey() && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setEditMenuOpen(false)
                                  onFocus(todo)
                                }}
                                className={MENU_ITEM_CLASS}
                              >
                                <Focus
                                  size={18}
                                  strokeWidth={1.75}
                                  className="shrink-0 opacity-70"
                                />
                                {t('todo.focus')}
                              </button>
                            )}

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setEditMenuOpen(false)
                              setExpanded((v) => !v)
                            }}
                            className={MENU_ITEM_CLASS}
                          >
                            {expanded ? (
                              <ChevronDown
                                size={18}
                                strokeWidth={1.75}
                                className="shrink-0 opacity-70"
                              />
                            ) : (
                              <ChevronRight
                                size={18}
                                strokeWidth={1.75}
                                className="shrink-0 opacity-70"
                              />
                            )}
                            {expanded
                              ? t('todo.collapseSteps')
                              : t('todo.expandSteps')}
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setEditMenuOpen(false)
                              handleDelete()
                            }}
                            className={`${MENU_ITEM_CLASS} text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40`}
                          >
                            <Trash2
                              size={18}
                              strokeWidth={1.75}
                              className="shrink-0 opacity-80"
                            />
                            {t('todo.delete')}
                          </button>
                        </div>
                      </>,
                      document.body,
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Бейджи ниже — не влияют на вертикальный центр текста */}
        {showMetaRow && (
          <div className="pl-[2.85rem] space-y-1">
            {(todo.habitId ||
              priority !== 'none' ||
              estimated > 0 ||
              spent > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {todo.habitId && (
                  <span className="inline-flex items-center rounded-full border border-[#B8DCC8]/80 bg-[#EAF6EF] px-2 py-0.5 text-[10px] font-medium text-[#3D6B52] dark:border-emerald-700/50 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {t('todo.habitBadge')}
                  </span>
                )}
                {priority !== 'none' && (
                  <MetaBadge
                    id={priority}
                    label={t(`meta.priority.${priority}`)}
                  />
                )}
                {(estimated > 0 || spent > 0) && (
                  <span className="inline-flex items-center rounded-full border border-black/[0.06] dark:border-zinc-600 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted dark:text-zinc-300">
                    {estimated > 0
                      ? t('todo.timeCompare', {
                          spent: formatTracked(spent, locale),
                          estimate: formatEstimate(estimated, locale),
                        })
                      : t('todo.timeSpent', {
                          spent: formatTracked(spent, locale),
                        })}
                  </span>
                )}
              </div>
            )}

            {(hasSubtasks || (showSubtasksHint && expanded)) && (
              <p className="text-xs text-muted dark:text-zinc-300">
                {hasSubtasks
                  ? t('todo.stepsProgress', {
                      done: doneSubtasks,
                      total: todo.subtasks.length,
                    })
                  : t('todo.splitHint')}
              </p>
            )}
          </div>
        )}

      <div
        className={['todo-accordion', expanded && !editing ? 'is-open' : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden={!(expanded && !editing)}
      >
        <div className="todo-accordion__inner">
          <div className="border-t border-black/[0.05] dark:border-zinc-700 px-3.5 pb-3.5 pt-2.5 space-y-2">
            {todo.subtasks.map((sub) => (
              <div
                key={sub.id}
                className="flex items-start gap-2.5 pl-1 group/sub"
              >
                <button
                  type="button"
                  onClick={() => onToggleSubtask(todo.id, sub.id)}
                  aria-label={
                    sub.completed
                      ? t('todo.uncompleteStep')
                      : t('todo.completeStep')
                  }
                  className={[
                    'todo-check touch-target flex shrink-0 items-center justify-center rounded-full transition-all',
                    sub.completed ? 'text-[var(--accent-contrast)]' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-5 w-5 items-center justify-center rounded-full border transition-all',
                      sub.completed
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                        : 'border-black/15 dark:border-[var(--border-color)] active:border-[var(--accent-color)]',
                    ].join(' ')}
                  >
                    {sub.completed && <Check size={11} strokeWidth={2.5} />}
                  </span>
                </button>
                <span className="flex-1 min-w-0 pt-2.5">
                  <span
                    className={[
                      'todo-strike text-base break-words whitespace-normal',
                      sub.completed
                        ? 'is-done text-muted/70 dark:text-zinc-500'
                        : 'text-ink-soft dark:text-zinc-200',
                    ].join(' ')}
                  >
                    {displayTodoText(sub.text)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteSubtask(todo.id, sub.id)}
                  aria-label={t('todo.deleteStep')}
                  className="btn-danger-hover touch-target flex items-center justify-center rounded-xl opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity text-muted"
                >
                  <X size={15} />
                </button>
              </div>
            ))}

            <form
              onSubmit={handleAddSubtask}
              className="flex items-center gap-2 pt-1"
            >
              <label className="flex flex-1 min-w-0 items-center gap-2 rounded-xl border border-black/[0.06] dark:border-zinc-600 bg-surface dark:bg-zinc-900 px-2.5 py-1.5">
                <Circle
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0 text-muted/60 dark:text-zinc-400"
                  aria-hidden
                />
                <input
                  type="text"
                  value={subtaskText}
                  onChange={(e) =>
                    setSubtaskText(e.target.value.slice(0, MAX_TODO_TEXT_LENGTH))
                  }
                  maxLength={MAX_TODO_TEXT_LENGTH}
                  placeholder={t('todo.addStepPlaceholder')}
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted/60 text-ink-soft dark:text-zinc-100"
                />
              </label>
              <button
                type="submit"
                aria-label={t('todo.addStep')}
                className="touch-target flex items-center justify-center rounded-xl border border-black/[0.06] dark:border-zinc-600 hover:bg-canvas-warm dark:hover:bg-zinc-800 active:bg-canvas-warm dark:active:bg-zinc-800 transition-colors text-muted dark:text-zinc-300"
              >
                <Plus size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
      </div>
    </li>
    {remindOpen &&
      createPortal(
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('todo.cancel')}
            className="fixed inset-0 z-[220] border-0 bg-black/45 backdrop-blur-[1px] animate-fade-in"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              closeRemind()
            }}
          />
          <div
            role="dialog"
            aria-label={t('todo.remindTitle')}
            className="todo-remind-sheet fixed inset-x-4 z-[230] mx-auto w-[min(23.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/[0.08] bg-surface p-4 shadow-[0_16px_48px_rgba(0,0,0,0.35)] animate-fade-in dark:border-zinc-700 dark:bg-zinc-900"
            style={{
              bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="font-display text-[17px] font-semibold text-ink dark:text-zinc-50">
              {t('todo.remindTitle')}
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-muted dark:text-zinc-400">
              {t('todo.remindHint')}
            </p>
            <div
              className={[
                'mt-3.5 grid items-end gap-2',
                todo.period === 'year'
                  ? 'grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.75fr)]'
                  : todo.period === 'day'
                    ? 'grid-cols-1'
                    : 'grid-cols-2',
              ].join(' ')}
            >
              <label
                className={[
                  'min-w-0',
                  todo.period === 'day' ? 'todo-remind-time--solo' : '',
                ].join(' ')}
              >
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted dark:text-zinc-400">
                  {t('todo.remindTime')}
                </span>
                <div className="todo-remind-time-wrap">
                  <span className="todo-remind-time-face" aria-hidden>
                    {remindDraft.time || '21:00'}
                  </span>
                  <input
                    type="time"
                    value={remindDraft.time}
                    onChange={(e) =>
                      setRemindDraft((prev) => ({
                        ...prev,
                        time: e.target.value,
                      }))
                    }
                    className="todo-remind-time-native"
                    aria-label={t('todo.remindTime')}
                  />
                </div>
              </label>
              {todo.period === 'week' && (
                <label className="min-w-0">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted dark:text-zinc-400">
                    {t('todo.remindWeekday')}
                  </span>
                  <RemindSelect
                    value={remindDraft.weekday}
                    onChange={(e) =>
                      setRemindDraft((prev) => ({
                        ...prev,
                        weekday: Number(e.target.value),
                      }))
                    }
                    ariaLabel={t('todo.remindWeekday')}
                    face={
                      t('calendar.weekdays').split(',')[
                        remindDraft.weekday - 1
                      ] ?? ''
                    }
                  >
                    {t('calendar.weekdays')
                      .split(',')
                      .map((label, index) => (
                        <option key={label} value={index + 1}>
                          {label}
                        </option>
                      ))}
                  </RemindSelect>
                </label>
              )}
              {todo.period === 'month' && (
                <label className="min-w-0">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted dark:text-zinc-400">
                    {t('todo.remindDay')}
                  </span>
                  <RemindSelect
                    value={remindDraft.monthDay}
                    onChange={(e) =>
                      setRemindDraft((prev) => ({
                        ...prev,
                        monthDay: Number(e.target.value),
                      }))
                    }
                    ariaLabel={t('todo.remindDay')}
                    face={remindDraft.monthDay}
                  >
                    {Array.from(
                      {
                        length: daysInMonth(
                          (todo.date ? parseDateKey(todo.date) : new Date()).getFullYear(),
                          (todo.date ? parseDateKey(todo.date) : new Date()).getMonth(),
                        ),
                      },
                      (_, i) => i + 1,
                    ).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </RemindSelect>
                </label>
              )}
              {todo.period === 'year' && (
                <>
                  <label className="min-w-0">
                    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted dark:text-zinc-400">
                      {t('todo.remindMonth')}
                    </span>
                    <RemindSelect
                      value={remindDraft.month}
                      onChange={(e) => {
                        const month = Number(e.target.value)
                        const year = (todo.date
                          ? parseDateKey(todo.date)
                          : new Date()
                        ).getFullYear()
                        const last = daysInMonth(year, month - 1)
                        setRemindDraft((prev) => ({
                          ...prev,
                          month,
                          monthDay: Math.min(prev.monthDay, last),
                        }))
                      }}
                      ariaLabel={t('todo.remindMonth')}
                      face={new Date(2000, remindDraft.month - 1, 1).toLocaleDateString(
                        localeTag,
                        { month: 'short' },
                      )}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2000, i, 1).toLocaleDateString(localeTag, {
                            month: 'short',
                          })}
                        </option>
                      ))}
                    </RemindSelect>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted dark:text-zinc-400">
                      {t('todo.remindDay')}
                    </span>
                    <RemindSelect
                      value={remindDraft.monthDay}
                      onChange={(e) =>
                        setRemindDraft((prev) => ({
                          ...prev,
                          monthDay: Number(e.target.value),
                        }))
                      }
                      ariaLabel={t('todo.remindDay')}
                      face={remindDraft.monthDay}
                    >
                      {Array.from(
                        {
                          length: daysInMonth(
                            (todo.date
                              ? parseDateKey(todo.date)
                              : new Date()
                            ).getFullYear(),
                            remindDraft.month - 1,
                          ),
                        },
                        (_, i) => i + 1,
                      ).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </RemindSelect>
                  </label>
                </>
              )}
            </div>
            {remindError && (
              <p className="mt-2 text-[13px] text-rose-500">{remindError}</p>
            )}
            <div className="mt-3.5 flex flex-col gap-2">
              <button
                type="button"
                disabled={remindSaving}
                onClick={() => void saveReminder()}
                className="min-h-12 rounded-xl bg-ink px-3 text-[16px] font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {t('todo.remindSave')}
              </button>
              {reminderTime && (
                <button
                  type="button"
                  disabled={remindSaving}
                  onClick={() => void removeReminder()}
                  className="min-h-11 rounded-xl px-3 text-[15px] text-rose-600 disabled:opacity-50 dark:text-rose-400"
                >
                  {t('todo.remindClear')}
                </button>
              )}
              <button
                type="button"
                onClick={closeRemind}
                className="min-h-11 rounded-xl px-3 text-[15px] text-muted dark:text-zinc-400"
              >
                {t('todo.cancel')}
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
