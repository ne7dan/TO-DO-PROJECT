import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  Focus,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { displayTodoText, MAX_TODO_TEXT_LENGTH } from '../utils/text'
import { toDateKey } from '../utils/dates'
import {
  formatEstimate,
  formatTracked,
  normalizeEstimateMinutes,
} from '../utils/estimate'
import { normalizePriority } from '../utils/todoMeta'
import { useLocale } from '../i18n/LocaleContext'
import { MetaBadge, MetaPicker } from './MetaChips'
import { TODO_DRAG_TYPE, touchTodoDrag } from '../hooks/useTodos'

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
  const { t, locale } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const [subtaskText, setSubtaskText] = useState('')
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editMenuOpen, setEditMenuOpen] = useState(false)
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
      setMenuPos({
        top: rect.bottom + 6,
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

  const handleGripTouchStart = (e) => {
    if (editing) return
    const touch = e.touches[0]
    if (!touch) return
    touchTodoDrag.id = todo.id
    setDragging(true)

    const onMove = (ev) => {
      if (touchTodoDrag.id !== todo.id) return
      const point = ev.touches[0]
      if (!point) return
      ev.preventDefault()
      clearTouchDragVisual()
      const el = document.elementFromPoint(point.clientX, point.clientY)
      const overTodo = el?.closest('[data-todo-drop]')
      const overCal = el?.closest('[data-cal-drop]')
      if (overTodo && overTodo.getAttribute('data-todo-drop') !== todo.id) {
        overTodo.classList.add('touch-drag-over')
      } else if (overCal) {
        overCal.classList.add('touch-drag-over')
      }
    }

    const onEnd = (ev) => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)

      const point = ev.changedTouches?.[0]
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
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
  }

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

  const handleAddSubtask = (e) => {
    e.preventDefault()
    if (!subtaskText.trim()) return
    onAddSubtask(todo.id, subtaskText)
    setSubtaskText('')
    setExpanded(true)
  }

  return (
    <li
      data-todo-drop={todo.id}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData(TODO_DRAG_TYPE, todo.id)
        e.dataTransfer.setData('text/plain', todo.id)
        e.dataTransfer.effectAllowed = 'copyMove'
        touchTodoDrag.id = todo.id
        setDragging(true)
      }}
      onDragEnd={() => {
        touchTodoDrag.id = null
        setDragging(false)
        setDragOver(false)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move'
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
        'group todo-row',
        dragOver ? 'is-drag-over' : '',
        dragging ? 'opacity-50' : '',
        removing ? 'animate-removing' : 'animate-todo-enter',
      ].join(' ')}
    >
      <div className="space-y-1.5 py-3.5 px-1 sm:px-1.5">
        {/* Строка задачи: текст по центру с чекбоксом */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            draggable={false}
            aria-label={t('todo.drag')}
            title={t('todo.drag')}
            className="touch-target flex h-11 w-11 shrink-0 cursor-grab active:cursor-grabbing items-center justify-center text-muted dark:text-zinc-400 hover:text-ink-soft dark:hover:text-zinc-200 active:text-ink-soft"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={handleGripTouchStart}
          >
            <GripVertical size={20} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => onToggle(todo.id)}
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
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="min-w-0 flex-1 truncate text-left text-[16.05px] leading-snug">
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
                          className="fixed z-[210] min-w-[11.5rem] overflow-hidden rounded-xl border border-black/[0.08] bg-surface py-1 shadow-[0_12px_40px_rgba(0,0,0,0.28)] animate-fade-in dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setEditMenuOpen(false)
                              startEdit()
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[14px] text-ink hover:bg-canvas-warm dark:text-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <Pencil
                              size={15}
                              strokeWidth={1.75}
                              className="shrink-0 opacity-70"
                            />
                            {t('todo.edit')}
                          </button>

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
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[14px] text-ink hover:bg-canvas-warm dark:text-zinc-100 dark:hover:bg-zinc-800"
                              >
                                <Focus
                                  size={15}
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
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[14px] text-ink hover:bg-canvas-warm dark:text-zinc-100 dark:hover:bg-zinc-800"
                          >
                            {expanded ? (
                              <ChevronDown
                                size={15}
                                strokeWidth={1.75}
                                className="shrink-0 opacity-70"
                              />
                            ) : (
                              <ChevronRight
                                size={15}
                                strokeWidth={1.75}
                                className="shrink-0 opacity-70"
                              />
                            )}
                            {expanded
                              ? t('todo.collapseSteps')
                              : t('todo.expandSteps')}
                          </button>
                        </div>
                      </>,
                      document.body,
                    )}

                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label={t('todo.delete')}
                    className="btn-danger-hover touch-target flex items-center justify-center rounded-xl text-muted/80 dark:text-zinc-400"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Бейджи ниже — не влияют на вертикальный центр текста */}
        {showMetaRow && (
          <div className="pl-[5.25rem] space-y-1">
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
      </div>

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
                className="flex items-center gap-2.5 pl-1 group/sub"
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
                <span className="flex-1 min-w-0">
                  <span
                    className={[
                      'todo-strike text-sm',
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
    </li>
  )
}
