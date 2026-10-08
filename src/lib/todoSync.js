function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Цепочка записей на один id — чтобы complete не уходил раньше insert. */
export function createWriteQueue() {
  const chains = new Map()

  function enqueue(key, task) {
    const id = String(key)
    const prev = chains.get(id) ?? Promise.resolve()
    const next = prev.then(task, task)
    chains.set(id, next)
    void next.finally(() => {
      if (chains.get(id) === next) chains.delete(id)
    })
    return next
  }

  function has(key) {
    return chains.has(String(key))
  }

  return { enqueue, has }
}

/**
 * PATCH + проверка, что строка реально обновилась.
 * Пустой ответ (0 rows) на iOS часто выглядит как «успех», но данные не уходят.
 */
export async function patchTodoRow(supabase, { userId, id, fields, attempts = 4 }) {
  let lastError = { message: 'empty_update' }

  for (let i = 0; i < attempts; i += 1) {
    const { data, error } = await supabase
      .from('todos')
      .update(fields)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

    if (!error && data?.id) return { ok: true, error: null }

    lastError = error || { message: 'empty_update' }
    const msg = lastError.message || ''

    if (/Could not find the 'title' column/i.test(msg) && fields.title !== undefined) {
      const { title: _drop, ...rest } = fields
      fields = rest
      continue
    }

    await wait(220 * (i + 1))
  }

  return { ok: false, error: lastError }
}
