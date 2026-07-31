import { useEffect, useRef, useState } from 'react'
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
  const [expanded, setExpanded] = useState(
    todo.period === 'month' || todo.period === 'year',
  )
  const [subtaskText, setSubtaskText] = useState('')
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [draftText, setDraftText] = useState(todo.text)
  const [draftPriority, setDraftPriority] = useState(
    normalizePriority(todo.priority),
  )
  const editInputRef = useRef(null)

  const doneSubtasks = todo.subtasks.filter((s) => s.completed).length
  const hasSubtasks = todo.subtasks.length > 0
  const priority = normalizePriority(todo.priority)
  const estimated = normalizeEstimateMinutes(todo.estimatedMinutes)
  const spent = Math.max(0, Math.floor(todo.spentSeconds || 0))

  useEffect(() => {
    if (!editing) return undefined
    editInputRef.current?.focus()
    editInputRef.current?.select()
    return undefined
  }, [editing])

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
      const t = ev.touches[0]
      if (!t) return
      ev.preventDefault()
      clearTouchDragVisual()
      const el = document.elementFromPoint(t.clientX, t.clientY)
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

      const t = ev.changedTouches?.[0]
      const el = t
        ? document.elementFromPoint(t.clientX, t.clientY)
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
        'group ui-inset transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:bg-zinc-950/60 dark:hover:shadow-sm',
        '[&.touch-drag-over]:border-[var(--accent-color)] [&.touch-drag-over]:ring-1 [&.touch-drag-over]:ring-[var(--accent-glow)]',
        dragOver
          ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-glow)]'
          : '',
        dragging ? 'opacity-50' : '',
        removing ? 'animate-removing' : 'animate-fade-in',
      ].join(' ')}
    >
      <div className="flex items-start gap-1 p-3.5">
        <button
          type="button"
          draggable={false}
          aria-label={t('todo.drag')}
          title={t('todo.drag')}
          className="touch-target mt-0 flex shrink-0 cursor-grab active:cursor-grabbing items-center justify-center text-muted/70 dark:text-zinc-400 hover:text-ink-soft dark:hover:text-zinc-200 active:text-ink-soft"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={handleGripTouchStart}
        >
          <GripVertical size={18} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => onToggle(todo.id)}
          aria-label={todo.completed ? t('todo.uncomplete') : t('todo.complete')}
          className={[
            'todo-check touch-target mt-0 flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-200',
            todo.completed
              ? 'text-[var(--accent-contrast)]'
              : 'text-transparent',
          ].join(' ')}
        >
          <span
            className={[
              'flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200',
              todo.completed
                ? 'bg-[var(--accent-color)] border-[var(--accent-color)] shadow-[0_0_0_3px_var(--accent-glow)]'
                : 'border-black/15 dark:border-[var(--border-color)] hover:border-[var(--accent-color)] active:border-[var(--accent-color)]',
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
                className="w-full rounded-xl border border-black/[0.08] dark:border-[var(--border-color)] bg-surface dark:bg-[var(--bg-card)] px-3 py-2 text-[15px] text-ink dark:text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-glow)]"
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
            <>
              <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 text-[15px] leading-snug">
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

                <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={startEdit}
                    aria-label={t('todo.edit')}
                    title={t('todo.edit')}
                    className="touch-target flex items-center justify-center rounded-xl hover:bg-black/[0.04] dark:hover:bg-zinc-800 active:bg-black/[0.06] dark:active:bg-zinc-800 text-muted dark:text-zinc-300"
                  >
                    <Pencil size={16} strokeWidth={1.75} />
                  </button>
                  {!todo.completed &&
                    todo.period === 'day' &&
                    todo.date === toDateKey() && (
                      <button
                        type="button"
                        onClick={() => onFocus(todo)}
                        aria-label={t('todo.focus')}
                        className="touch-target flex items-center justify-center rounded-xl hover:bg-black/[0.04] dark:hover:bg-zinc-800 active:bg-black/[0.06] dark:active:bg-zinc-800 text-muted dark:text-zinc-300"
                        title="Focus Mode"
                      >
                        <Focus size={16} strokeWidth={1.75} />
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-label={
                      expanded ? t('todo.collapseSteps') : t('todo.expandSteps')
                    }
                    className="touch-target flex items-center justify-center rounded-xl hover:bg-black/[0.04] dark:hover:bg-zinc-800 active:bg-black/[0.06] dark:active:bg-zinc-800 text-muted dark:text-zinc-300"
                  >
                    {expanded ? (
                      <ChevronDown size={16} strokeWidth={1.75} />
                    ) : (
                      <ChevronRight size={16} strokeWidth={1.75} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label={t('todo.delete')}
                    className="touch-target flex items-center justify-center rounded-xl hover:bg-black/[0.04] dark:hover:bg-zinc-800 active:bg-black/[0.06] dark:active:bg-zinc-800 text-muted/80 dark:text-zinc-400 hover:text-ink dark:hover:text-zinc-100"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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

              {(hasSubtasks || showSubtasksHint) && (
                <p className="mt-1 text-xs text-muted dark:text-zinc-300">
                  {hasSubtasks
                    ? t('todo.stepsProgress', {
                        done: doneSubtasks,
                        total: todo.subtasks.length,
                      })
                    : t('todo.splitHint')}
                </p>
              )}
            </>
          )}
        </div>
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
                    sub.completed
                      ? 'text-[var(--accent-contrast)]'
                      : '',
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
                  className="touch-target flex items-center justify-center rounded-xl opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity text-muted hover:text-ink dark:hover:text-zinc-100 active:bg-black/[0.04] dark:active:bg-zinc-800"
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
