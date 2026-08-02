interface Entry { count: number; reset: number }

const store = new Map<string, Entry>()

// Purge des entrées expirées toutes les 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.reset + 3_600_000) store.delete(key)
  }
}, 600_000).unref()

/**
 * Retourne true si la requête est autorisée, false si le quota est dépassé.
 * @param key    Clé unique (ex: "endpoint:ip")
 * @param limit  Nombre max de requêtes dans la fenêtre
 * @param windowMs Durée de la fenêtre en ms
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false
  entry.count++
  return true
}
