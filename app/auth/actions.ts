'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Rate limiting login (in-memory, par email, persistant par process PM2) ───
const WINDOW_MS = 15 * 60 * 1000 // fenêtre glissante 15 min
const LOCKS: Array<{ minFailures: number; lockMs: number }> = [
  { minFailures: 20, lockMs: 60 * 60 * 1000 },
  { minFailures: 10, lockMs: 15 * 60 * 1000 },
  { minFailures:  5, lockMs:  2 * 60 * 1000 },
]
type Entry = { count: number; windowStart: number; lockedUntil: number }
const loginAttempts = new Map<string, Entry>()

export async function checkLoginRateLimit(
  email: string
): Promise<{ blocked: boolean; waitSeconds: number }> {
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

export async function recordFailedLogin(email: string): Promise<void> {
  const key = email.toLowerCase().trim()
  const now = Date.now()
  const entry = loginAttempts.get(key)
  const windowStart = entry && now - entry.windowStart <= WINDOW_MS ? entry.windowStart : now
  const count = entry && now - entry.windowStart <= WINDOW_MS ? entry.count + 1 : 1
  const lock = LOCKS.find(l => count >= l.minFailures)
  loginAttempts.set(key, { count, windowStart, lockedUntil: lock ? now + lock.lockMs : 0 })
}

export async function clearLoginAttempts(email: string): Promise<void> {
  loginAttempts.delete(email.toLowerCase().trim())
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Identifiants incorrects' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Compte créé avec succès. Vous pouvez maintenant vous connecter.')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login')
}
