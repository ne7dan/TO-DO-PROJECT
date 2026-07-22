export const MAX_TODO_TEXT_LENGTH = 200

/** Обрезает и нормализует пользовательский текст перед сохранением. */
export function sanitizeTodoText(value) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, MAX_TODO_TEXT_LENGTH)
}

/** Безопасный текст для отображения (в т.ч. данные из localStorage). */
export function displayTodoText(value) {
  if (typeof value !== 'string') return ''
  return value.slice(0, MAX_TODO_TEXT_LENGTH)
}
