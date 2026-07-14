"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Turnstile } from "@marsidev/react-turnstile"
import { requestTwoFactorCodeAction, verifyTwoFactorCodeAction } from "@/app/actions/two-factor"

export function AuthScreen({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [persistentError, setPersistentError] = useState<string | null>(null)

  // Lien expiré (depuis ?error=link_expired dans l'URL)
  const [isLinkExpiredMode, setIsLinkExpiredMode] = useState(initialError === "link_expired")

  // Nouveaux états pour le flux de reset
  const [isResetMode, setIsResetMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)

  // États 2FA email
  const [showEmailMfaStep, setShowEmailMfaStep] = useState(false)
  const [emailMfaCode, setEmailMfaCode] = useState('')
  const [emailMfaError, setEmailMfaError] = useState<string | null>(null)
  const [emailResendCooldown, setEmailResendCooldown] = useState(0)

  const router = useRouter()
  const supabase = createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")

  // BUG 1 fallback: si Supabase redirige vers /login#access_token=...&type=invite
  // (redirect URL non whitelistée dans le dashboard Supabase), on échange le token côté client
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token') || !hash.includes('type=invite')) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        router.replace('/auth/reset-password')
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setPersistentError(null)
    setForgotSent(false)

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken || undefined }
    })
    
    // Réinitialiser le Turnstile après l'appel
    setCaptchaToken(null)
    setTurnstileKey(prev => prev + 1)

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes("invalid login credentials")) {
        setError("Email ou mot de passe incorrect.")
      } else if (msg.includes("email not confirmed")) {
        setPersistentError("Veuillez confirmer votre email avant de vous connecter.")
      } else {
        setError(error.message)
      }
      setIsLoading(false)
      return
    }

    // Vérifier 2FA côté client — session disponible immédiatement après signInWithPassword
    const userId = authData.user?.id
    if (userId) {
      const { data: account } = await supabase
        .from('user_accounts')
        .select('two_factor_email_enabled')
        .eq('id', userId)
        .maybeSingle()
      if (account?.two_factor_email_enabled) {
        await requestTwoFactorCodeAction()
        setShowEmailMfaStep(true)
        setIsLoading(false)
        startEmailResendCooldown()
        return
      }
    }

    router.push("/")
    router.refresh()
  }

  function startEmailResendCooldown() {
    setEmailResendCooldown(60)
    const timer = setInterval(() => {
      setEmailResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function handleEmailMfaVerify(e: React.FormEvent) {
    e.preventDefault()
    if (emailMfaCode.length !== 6) return
    setIsLoading(true)
    setEmailMfaError(null)
    try {
      const result = await verifyTwoFactorCodeAction(emailMfaCode)
      if (!result.success) {
        setEmailMfaError(result.error ?? 'Code incorrect, veuillez réessayer.')
        setEmailMfaCode('')
        setIsLoading(false)
        return
      }
      router.push("/")
      router.refresh()
    } catch {
      setEmailMfaError('Une erreur est survenue. Veuillez réessayer.')
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    setForgotSent(false)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    })
    if (error) {
      setError("Connexion Google indisponible. Veuillez réessayer.")
    }
  }

  async function handleSendResetLink(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    setForgotSent(false)
    
    if (!email) {
      setError("Veuillez saisir votre adresse email.")
      return
    }
    
    setIsLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?type=recovery`,
      captchaToken: captchaToken || undefined,
    })
    
    setIsLoading(false)
    
    // Réinitialiser le Turnstile après l'appel
    setCaptchaToken(null)
    setTurnstileKey(prev => prev + 1)

    if (error) {
      setError(error.message)
    } else {
      setForgotSent(true)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000]"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)]" />

      {/* Content Container */}
      <div className="relative w-full max-w-sm px-6">

        {/* Logo Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 sm:mb-10 flex flex-col items-center"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-20 blur-3xl bg-[#D4AF37]/15 w-40 h-40 rounded-full" />
          <span
            className="relative font-serif text-7xl leading-none"
            style={{ color: "#C9A84C" }}
          >
            N
          </span>
          <span
            className="relative mt-2 text-sm tracking-widest"
            style={{ color: "#8B6914" }}
          >
            NoX VTC
          </span>
          {isResetMode && (
            <p className="mt-4 text-[13px] text-[#D4AF37] font-semibold tracking-[0.1em] uppercase">
              Réinitialiser mon mot de passe
            </p>
          )}
        </motion.div>

        {/* Forms */}
        <AnimatePresence mode="wait">
          {showEmailMfaStep ? (
            <motion.form
              key="email-mfa-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleEmailMfaVerify}
              className="space-y-4"
            >
              <div className="flex flex-col items-center mb-2">
                <div className="w-14 h-14 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-2">Vérification en 2 étapes</h2>
                <p className="text-[13px] text-[#888888] text-center leading-relaxed">
                  Un code à 6 chiffres a été envoyé à votre adresse email.
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={emailMfaCode}
                onChange={(e) => setEmailMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                autoFocus
                className="w-full h-14 px-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] text-center font-mono placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
                style={{ fontSize: "22px", letterSpacing: "0.15em" }}
              />
              {emailMfaError && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400">
                  {emailMfaError}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || emailMfaCode.length !== 6}
                className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
              >
                {isLoading ? 'Vérification...' : 'Vérifier'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (emailResendCooldown > 0) return
                  await requestTwoFactorCodeAction()
                  startEmailResendCooldown()
                }}
                disabled={emailResendCooldown > 0}
                className="w-full text-[12px] text-[#888888] hover:text-[#D4AF37] transition-colors py-2 disabled:opacity-50"
              >
                {emailResendCooldown > 0 ? `Renvoyer dans ${emailResendCooldown}s` : 'Renvoyer le code'}
              </button>
              <button
                type="button"
                onClick={() => { setShowEmailMfaStep(false); setEmailMfaCode(''); setEmailMfaError(null) }}
                className="w-full flex items-center justify-center gap-2 text-[12px] text-[#FFFFFF] hover:text-[#D4AF37] transition-colors py-3"
              >
                <ArrowLeft className="h-3 w-3" /> Retour à la connexion
              </button>
            </motion.form>
          ) : isLinkExpiredMode ? (
            <motion.div
              key="link-expired"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center mb-2">
                <div className="w-16 h-16 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7 text-amber-400" strokeWidth={1.5} />
                </div>
                <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-2">Lien expiré</h2>
                <p className="text-[13px] text-[#888888] leading-relaxed text-center">
                  Ce lien a expiré ou a déjà été utilisé. Si un email plus récent vous a été envoyé, utilisez ce dernier — sinon, cliquez ci-dessous pour en recevoir un nouveau.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/register")}
                className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20"
              >
                Recevoir un nouveau lien
              </button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkExpiredMode(false)}
                  className="w-full flex items-center justify-center gap-2 text-[12px] text-[#FFFFFF] hover:text-[#D4AF37] transition-colors duration-300 py-3 px-4"
                >
                  <ArrowLeft className="h-3 w-3" /> Retour à la connexion
                </button>
              </div>
            </motion.div>
          ) : isResetMode ? (
            <motion.form
              key="reset-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSendResetLink}
              className="space-y-4"
            >
              {forgotSent ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-[13px] text-emerald-400 leading-relaxed">
                    Si un compte est associé à <strong>{email}</strong>, vous recevrez un lien de réinitialisation. Vérifiez votre boîte mail.
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Mail className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
                    </div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-14 pl-11 pr-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  
                  {/* Turnstile Widget */}
                  <div className="flex justify-center mt-2 mb-2">
                    <Turnstile
                      key={`turnstile-reset-${turnstileKey}`}
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => { setCaptchaToken(null); setTurnstileKey(prev => prev + 1) }}
                      onError={() => setCaptchaToken(null)}
                      options={{ theme: 'dark', refreshExpired: 'auto' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !captchaToken}
                    className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[12px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
                  >
                    Envoyer le lien de réinitialisation
                  </button>
                </>
              )}
              
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false)
                    setError(null)
                    setForgotSent(false)
                  }}
                  className="w-full flex items-center justify-center gap-2 text-[12px] text-[#FFFFFF] hover:text-[#D4AF37] transition-colors duration-300 py-3 px-4"
                >
                  <ArrowLeft className="h-3 w-3" /> Retour à la connexion
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="login-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
              {/* Email Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Mail className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 pl-11 pr-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
                  style={{ fontSize: "16px" }}
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
                  style={{ fontSize: "16px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
                  )}
                </button>
              </div>

              {/* Turnstile Widget */}
              <div className="flex justify-center mt-2 mb-2">
                <Turnstile
                  key={`turnstile-login-${turnstileKey}`}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => { setCaptchaToken(null); setTurnstileKey(prev => prev + 1) }}
                  onError={() => setCaptchaToken(null)}
                  options={{ theme: 'dark', refreshExpired: 'auto' }}
                />
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading || !captchaToken}
                className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
              >
                Se connecter
              </button>
              
              {/* Divider */}
              <div className="flex items-center gap-4 my-4 sm:my-6">
                <div className="flex-1 h-px bg-[#D4AF37]/20" />
                <span className="text-[11px] text-[#FFFFFF] tracking-wide uppercase">Ou continuer avec</span>
                <div className="flex-1 h-px bg-[#D4AF37]/20" />
              </div>

              {/* Social Login Buttons */}
              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  title="Se connecter avec Google"
                  className="w-14 h-14 rounded-full bg-[#0A0A0A] border border-[#D4AF37]/10 flex items-center justify-center hover:bg-[#1A1A1A] hover:border-[#D4AF37]/25 active:scale-95 transition-all"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </button>

                {/* Bientôt dispos */}
                <div
                  aria-disabled="true"
                  title="Bientôt disponible"
                  className="relative group w-14 h-14 rounded-full bg-[#0A0A0A] border border-white/5 flex items-center justify-center"
                  style={{ cursor: "not-allowed" }}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#FFFFFF" style={{ opacity: 0.25, filter: "grayscale(1)" }}>
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-[#555555] tracking-wide whitespace-nowrap">Bientôt</span>
                </div>
                <div
                  aria-disabled="true"
                  title="Bientôt disponible"
                  className="relative group w-14 h-14 rounded-full bg-[#0A0A0A] border border-white/5 flex items-center justify-center"
                  style={{ cursor: "not-allowed" }}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#1877F2" style={{ opacity: 0.25, filter: "grayscale(1)" }}>
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-[#555555] tracking-wide whitespace-nowrap">Bientôt</span>
                </div>
              </div>

              {/* Footer Links */}
              <div className="mt-6 sm:mt-10 flex flex-row items-center justify-center gap-1 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setIsResetMode(true)
                  }}
                  className="text-[12px] text-[#FFFFFF] hover:text-[#D4AF37] transition-colors duration-300 py-2 px-2 sm:px-4"
                >
                  Mot de passe oublié ?
                </button>
                <span className="text-[#D4AF37]/30 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="text-[12px] text-[#D4AF37] hover:text-[#E5C04B] transition-colors duration-300 py-2 px-2 sm:px-4 font-medium"
                >
                  S'inscrire
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Error Feedback */}
        <AnimatePresence>
          {(persistentError || error) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-4 px-4 py-3 rounded-lg text-center text-[12px] tracking-wide leading-relaxed ${
                persistentError
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {persistentError || error}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#000000]/95 backdrop-blur-sm"
          >
            {/* Spinner */}
            <div className="relative w-12 h-12 mb-5">
              <div className="absolute inset-0 rounded-full border-2 border-[#D4AF37]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#D4AF37] animate-spin" />
            </div>
            <p className="text-[13px] text-[#D4AF37]/90 font-light tracking-wide">
              Veuillez patienter...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative bottom line */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />

      {/* Legal Links */}
      <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2">
        <a href="/politique-de-confidentialite" className="text-[10px] text-[#555555] hover:text-[#D4AF37] transition-colors">Politique de confidentialité</a>
        <span className="text-[#555555] text-[10px]">·</span>
        <a href="/politique-de-cookies" className="text-[10px] text-[#555555] hover:text-[#D4AF37] transition-colors">Politique de cookies</a>
      </div>
    </motion.div>
  )
}
