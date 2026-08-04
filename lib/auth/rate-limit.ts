const WINDOW_MS = 15 * 60 * 1000
const LOCKS: Array<{ minFailures: number; lockMs: number }> = [
  { minFailures: 20, lockMs: 60 * 60 * 1000 },
  { minFailures: 10, lockMs: 15 * 60 * 1000 },
  { minFailures:  5, lockMs:  2 * 60 * 1000 },
]
type Entry = { count: number; windowStart: number; lockedUntil: number }
const loginAttempts = new Map<string, Entry>()

export function checkLoginRateLimit(email: string): { blocked: boolean; waitSeconds: number } {
  const key = email.toLowerCase().trim()
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry) return { blocked: false, waitSeconds: 0 }
  if (now - entry.windowStart > WINDOW_MS) {
    loginAttempts.delete(key)
    return { blocked: false, waitSeconds: 0 }
  }
  if (entry.lockedUntil > now) {
    return { blocked: true, waitSeconds: Math.ceil((entry.lockedUntil - now) / 1000) }
  }
  return { blocked: false, waitSeconds: 0 }
}

export function recordFailedLogin(email: string): void {
  const key = email.toLowerCase().trim()
  const now = Date.now()
  const entry = loginAttempts.get(key)
  const windowStart = entry && now - entry.windowStart <= WINDOW_MS ? entry.windowStart : now
  const count = entry && now - entry.windowStart <= WINDOW_MS ? entry.count + 1 : 1
  const lock = LOCKS.find(l => count >= l.minFailures)
  loginAttempts.set(key, { count, windowStart, lockedUntil: lock ? now + lock.lockMs : 0 })
}
