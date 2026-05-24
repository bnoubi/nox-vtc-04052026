'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Turnstile } from '@marsidev/react-turnstile'
import { checkAdminRole } from '../actions'
import '../admin-globals.css'

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(6, 'Mot de passe requis (6 caractères min.)'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function AdminLoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [turnstileError, setTurnstileError] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginFormData) {
    setLoading(true)
    setServerError(null)

    const supabase = createClient()

    console.log('[Admin Login] Tentative de connexion:', {
      email: data.email,
      password: `*** (${data.password.length} chars)`,
    })

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
      options: { captchaToken: captchaToken || undefined },
    })

    setCaptchaToken(null)
    setTurnstileError(false)
    setTurnstileKey(prev => prev + 1)

    console.log('[Admin Login] Réponse signInWithPassword:', { data: authData, error: authError })

    if (authError) {
      console.error('[Admin Login] Erreur auth détaillée:', authError)
      setServerError(
        `Erreur d'authentification : ${authError.message} (code: ${authError.status ?? 'N/A'})`
      )
      setLoading(false)
      return
    }

    // Vérification du rôle admin via Server Action (service role, contourne la RLS)
    const isAdmin = await checkAdminRole()

    if (!isAdmin) {
      await supabase.auth.signOut()
      setServerError("Accès refusé. Vous n'avez pas les permissions nécessaires.")
      setLoading(false)
      return
    }

    console.log('[Admin Login] Rôle validé, redirection...')
    setLoading(false)
    router.push('/admin/dashboard')
  }

  return (
    <div
      data-admin-theme="dark"
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--admin-background)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--admin-primary)' }}>
            NoX VTC
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
            Back-Office Admin
          </p>
        </div>

        {/* Carte de connexion */}
        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: 'var(--admin-card)',
            borderColor: 'var(--admin-border)',
          }}
        >
          <h2
            className="text-xl font-semibold mb-1"
            style={{ color: 'var(--admin-foreground)' }}
          >
            Connexion
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--admin-muted-foreground)' }}>
            Accès réservé aux administrateurs
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: 'var(--admin-foreground)' }}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@exemple.fr"
                {...register('email')}
                style={{
                  backgroundColor: 'var(--admin-background)',
                  borderColor: errors.email ? 'var(--admin-destructive)' : 'var(--admin-border)',
                  color: 'var(--admin-foreground)',
                }}
              />
              {errors.email && (
                <p className="text-xs" style={{ color: 'var(--admin-destructive)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" style={{ color: 'var(--admin-foreground)' }}>
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                style={{
                  backgroundColor: 'var(--admin-background)',
                  borderColor: errors.password
                    ? 'var(--admin-destructive)'
                    : 'var(--admin-border)',
                  color: 'var(--admin-foreground)',
                }}
              />
              {errors.password && (
                <p className="text-xs" style={{ color: 'var(--admin-destructive)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <div
                className="text-sm p-3 rounded-lg"
                style={{
                  color: 'var(--admin-destructive)',
                  backgroundColor: 'rgba(229, 62, 62, 0.1)',
                  border: '1px solid rgba(229, 62, 62, 0.3)',
                }}
              >
                {serverError}
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <Turnstile
                key={turnstileKey}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'}
                onSuccess={(token) => { setCaptchaToken(token); setTurnstileError(false) }}
                onError={() => { setCaptchaToken(null); setTurnstileError(true) }}
                onExpire={() => setCaptchaToken(null)}
                options={{
                  theme: 'dark',
                  size: 'normal',
                  appearance: 'always',
                }}
              />
              {turnstileError && (
                <p className="text-xs text-center" style={{ color: 'var(--admin-destructive)' }}>
                  Vérification de sécurité indisponible. Rechargez la page.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !captchaToken}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
