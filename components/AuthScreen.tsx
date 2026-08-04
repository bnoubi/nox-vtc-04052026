"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Turnstile } from "@marsidev/react-turnstile"
import { requestTwoFactorCodeAction, verifyTwoFactorCodeAction } from "@/app/actions/two-factor"
import { sendPasswordResetCodeAction, verifyPasswordResetCodeAction, resetPasswordAction } from "@/app/actions/password-reset"
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from "@/app/auth/actions"
import { isPasswordStrong } from "@/lib/password"

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
  const [resetStep, setResetStep] = useState<'email' | 'code' | 'password'>('email')
  const [resetCode, setResetCode] = useState('')
  const [resetCodeError, setResetCodeError] = useState<string | null>(null)
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resetShowNewPassword, setResetShowNewPassword] = useState(false)
  const [resetShowConfirm, setResetShowConfirm] = useState(false)
  const [resetResendCooldown, setResetResendCooldown] = useState(0)
  const [resetSuccess, setResetSuccess] = useState(false)
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

    // Vérification rate limit avant la tentative
    const rl = await checkLoginRateLimit(email)
    if (rl.blocked) {
      const mins = Math.ceil(rl.waitSeconds / 60)
      setError(`Trop de tentatives échouées. Réessayez dans ${mins} minute${mins > 1 ? 's' : ''}.`)
      setIsLoading(false)
      return
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken || undefined }
    })

    // Réinitialiser le Turnstile après l'appel
    setCaptchaToken(null)
    setTurnstileKey(prev => prev + 1)

    if (error) {
      await recordFailedLogin(email)
      const msg = error.message.toLowerCase()
      if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
        setError("Email ou mot de passe incorrect.")
      } else if (msg.includes("email not confirmed")) {
        setPersistentError("Veuillez confirmer votre email avant de vous connecter.")
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.")
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.")
      }
      setIsLoading(false)
      return
    }

    // Connexion réussie — réinitialiser le compteur
    await clearLoginAttempts(email)

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

  async function doEmailMfaVerify() {
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
      setEmailMfaError('Erreur réseau, veuillez réessayer.')
      setIsLoading(false)
    }
  }

  async function handleEmailMfaVerify(e: React.FormEvent) {
    e.preventDefault()
    await doEmailMfaVerify()
  }

  // OAUTH_DISABLED — réactiver quand le bug de redirection Android est résolu
  // async function handleGoogleLogin() {
  //   setError(null)
  //   setForgotSent(false)
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider: "google",
  //     options: { redirectTo: `${siteUrl}/auth/callback` },
  //   })
  //   if (error) setError("Connexion Google indisponible. Veuillez réessayer.")
  // }

  function startResetResendCooldown() {
    setResetResendCooldown(60)
    const timer = setInterval(() => {
      setResetResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendResetCode(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    if (!email) { setError("Veuillez saisir votre adresse email."); return }
    setIsLoading(true)
    await sendPasswordResetCodeAction(email)
    setIsLoading(false)
    setCaptchaToken(null)
    setTurnstileKey(prev => prev + 1)
    setResetStep('code')
    startResetResendCooldown()
  }

  async function handleVerifyResetCode(e: React.FormEvent) {
    e.preventDefault()
    if (resetCode.length !== 6) return
    setIsLoading(true)
    setResetCodeError(null)
    const result = await verifyPasswordResetCodeAction(email, resetCode)
    setIsLoading(false)
    if (!result.success) {
      setResetCodeError(result.error ?? 'Code incorrect.')
      return
    }
    setResetStep('password')
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setResetCodeError(null)
    if (resetNewPassword !== resetConfirmPassword) {
      setResetCodeError("Les mots de passe ne correspondent pas.")
      return
    }
    if (!isPasswordStrong(resetNewPassword)) {
      setResetCodeError("Le mot de passe doit contenir au moins 8 caractères, avec une minuscule, une majuscule, un chiffre et un caractère spécial.")
      return
    }
    setIsLoading(true)
    const result = await resetPasswordAction(email, resetCode, resetNewPassword)
    setIsLoading(false)
    if (!result.success) {
      setResetCodeError(result.error ?? 'Erreur inattendue. Veuillez réessayer.')
      return
    }
    setResetSuccess(true)
    setTimeout(() => {
      setIsResetMode(false)
      setResetStep('email')
      setResetCode('')
      setResetCodeError(null)
      setResetNewPassword('')
      setResetConfirmPassword('')
      setResetSuccess(false)
    }, 3000)
  }

  async function handleResendResetCode() {
    if (resetResendCooldown > 0) return
    setIsLoading(true)
    setResetCodeError(null)
    await sendPasswordResetCodeAction(email)
    setIsLoading(false)
    startResetResendCooldown()
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
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400 space-y-2">
                  <p>{emailMfaError}</p>
                  {emailMfaCode.length === 6 && (
                    <button
                      type="button"
                      onClick={doEmailMfaVerify}
                      className="text-[11px] text-red-300 underline underline-offset-2 hover:text-red-200 transition-colors"
                    >
                      Réessayer
                    </button>
                  )}
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
              key={`reset-${resetStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={
                resetStep === 'email' ? handleSendResetCode
                : resetStep === 'code' ? handleVerifyResetCode
                : handleResetPassword
              }
              className="space-y-4"
            >
              {resetSuccess ? (
                <div className="flex flex-col items-center text-center py-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
                    <CheckCircle className="w-6 h-6 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-[16px] font-semibold text-[#F5F5F5] mb-2">Mot de passe mis à jour</h2>
                  <p className="text-[13px] text-[#888888] leading-relaxed">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                </div>
              ) : resetStep === 'email' ? (
                <>
                  <p className="text-[13px] text-[#888888] leading-relaxed text-center">
                    Entrez votre email. Nous vous enverrons un code à 6 chiffres — aucun lien à cliquer.
                  </p>
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
                    Envoyer le code
                  </button>
                </>
              ) : resetStep === 'code' ? (
                <>
                  <p className="text-[13px] text-[#888888] leading-relaxed text-center">
                    Un code à 6 chiffres a été envoyé à <span className="text-[#D4AF37]">{email}</span>. Valable 10 minutes.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    autoFocus
                    className="w-full h-14 px-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] text-center font-mono placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
                    style={{ fontSize: "22px", letterSpacing: "0.15em" }}
                  />
                  {resetCodeError && (
                    <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400">
                      {resetCodeError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || resetCode.length !== 6}
                    className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
                  >
                    {isLoading ? 'Vérification...' : 'Vérifier le code'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendResetCode}
                    disabled={resetResendCooldown > 0 || isLoading}
                    className="w-full text-[12px] text-[#888888] hover:text-[#D4AF37] transition-colors py-2 disabled:opacity-50"
                  >
                    {resetResendCooldown > 0 ? `Renvoyer dans ${resetResendCooldown}s` : 'Renvoyer le code'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[#888888] leading-relaxed text-center">
                    Choisissez un nouveau mot de passe.
                  </p>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Lock className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
                    </div>
                    <input
                      type={resetShowNewPassword ? "text" : "password"}
                      placeholder="Nouveau mot de passe"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      autoFocus
                      className="w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
                      style={{ fontSize: "16px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setResetShowNewPassword(!resetShowNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                    >
                      {resetShowNewPassword ? <EyeOff className="h-4 w-4 text-[#555555]" strokeWidth={1.5} /> : <Eye className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Lock className="h-4 w-4 text-[#D4AF37]/30" strokeWidth={1.5} />
                    </div>
                    <input
                      type={resetShowConfirm ? "text" : "password"}
                      placeholder="Confirmer le mot de passe"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
                      style={{ fontSize: "16px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setResetShowConfirm(!resetShowConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                    >
                      {resetShowConfirm ? <EyeOff className="h-4 w-4 text-[#555555]" strokeWidth={1.5} /> : <Eye className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />}
                    </button>
                  </div>
                  {resetCodeError && (
                    <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400">
                      {resetCodeError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || !isPasswordStrong(resetNewPassword) || resetNewPassword !== resetConfirmPassword}
                    className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
                  >
                    {isLoading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
                  </button>
                </>
              )}
              {!resetSuccess && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (resetStep === 'code') {
                        setResetStep('email')
                        setResetCode('')
                        setResetCodeError(null)
                      } else if (resetStep === 'password') {
                        setResetStep('code')
                        setResetCodeError(null)
                      } else {
                        setIsResetMode(false)
                        setResetStep('email')
                        setError(null)
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 text-[12px] text-[#FFFFFF] hover:text-[#D4AF37] transition-colors duration-300 py-3 px-4"
                  >
                    <ArrowLeft className="h-3 w-3" /> {resetStep === 'email' ? 'Retour à la connexion' : 'Retour'}
                  </button>
                </div>
              )}
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
              
              {/* OAUTH_DISABLED — divider + boutons Google/Apple/Facebook retirés pour soumission stores
              <div className="flex items-center gap-4 my-4 sm:my-6">
                <div className="flex-1 h-px bg-[#D4AF37]/20" />
                <span className="text-[11px] text-[#FFFFFF] tracking-wide uppercase">Ou continuer avec</span>
                <div className="flex-1 h-px bg-[#D4AF37]/20" />
              </div>
              <div className="flex items-center justify-center gap-5">
                [Google button]
                [Apple button — bientôt]
                [Facebook button — bientôt]
              </div>
              */}

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
