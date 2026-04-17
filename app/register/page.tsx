"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, User, CheckCircle2, XCircle } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Turnstile } from "@marsidev/react-turnstile"

export function isPasswordStrong(pwd: string) {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)
}

export function PasswordStrengthIndicator({ password, show }: { password: string; show: boolean }) {
  if (!show) return null

  const criteria = [
    { label: "Au moins 8 caractères", valid: password.length >= 8 },
    { label: "Au moins une majuscule", valid: /[A-Z]/.test(password) },
    { label: "Au moins un chiffre", valid: /[0-9]/.test(password) },
    { label: "Au moins un caractère spécial", valid: /[^A-Za-z0-9]/.test(password) }
  ]

  return (
    <div className="mt-2 space-y-1.5 p-3 rounded-xl bg-black/40 border border-[#D4AF37]/20">
      {criteria.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] font-medium">
          {c.valid ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-500/80" strokeWidth={2} />
          )}
          <span className={c.valid ? "text-emerald-500" : "text-[#888888]"}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function RegisterPage() {
  const [prenom, setPrenom] = useState("")
  const [nom, setNom] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // On désactive le bouton tant que 1) tout n'est pas rempli, 2) les MDP ne matchent pas, 3) password est trop faible, 4) Captcha n'est pas rempli
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const canSubmit = prenom && nom && email && isPasswordStrong(password) && passwordsMatch && captchaToken

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailAlreadyExists(false)

    if (!canSubmit) return

    setIsLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken: captchaToken || undefined,
        data: {
          prenom,
          nom,
          full_name: `${prenom} ${nom}`.trim(),
        },
      },
    })

    setIsLoading(false)

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes("password") && msg.includes("weak")) {
        setError("Mot de passe trop faible. Utilisez au moins 8 caractères avec lettres et chiffres.")
      } else if (msg.includes("invalid email") || msg.includes("valid email")) {
        setError("Adresse email invalide. Vérifiez le format.")
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Trop de tentatives. Veuillez patienter quelques minutes.")
      } else if (msg.includes("captcha")) {
        setError("Vérification anti-robot échouée. Veuillez réessayer.")
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.")
      }
      return
    }

    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setEmailAlreadyExists(true)
      return
    }

    setSuccess(true)
  }

  async function handleGoogleLogin() {
    setError(null)
    setEmailAlreadyExists(false)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError("Connexion Google indisponible. Veuillez réessayer.")
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)]" />
        <div className="relative w-full max-w-sm px-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-3 tracking-wide">Compte créé</h2>
          <p className="text-[13px] text-[#888888] leading-relaxed mb-8">
            Vérifiez votre boîte mail pour confirmer votre adresse email, puis connectez-vous.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20"
          >
            Se connecter
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-start py-10 relative">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 flex flex-col items-center"
        >
          <div className="relative w-full max-w-[180px]">
            <Image
              src="/assets/logo.png"
              alt="Logo NOX"
              width={180}
              height={90}
              priority
              className="w-full h-auto drop-shadow-[0_0_25px_rgba(212,175,55,0.35)]"
            />
          </div>
          <p className="mt-3 text-[12px] text-[#D4AF37]/60 tracking-[0.2em] uppercase">Créer un compte</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-3"
        >
          {/* Prénom */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <User className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
            </div>
            <input
              type="text"
              placeholder="Prénom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
              className="w-full h-14 pl-11 pr-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Nom */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <User className="h-4 w-4 text-[#D4AF37]/30" strokeWidth={1.5} />
            </div>
            <input
              type="text"
              placeholder="Nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              className="w-full h-14 pl-11 pr-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Email */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Mail className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-14 pl-11 pr-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Mot de passe */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Lock className="h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border ${password && !isPasswordStrong(password) ? "border-red-500/50" : "border-[#D4AF37]/30"} text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors`}
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
          <PasswordStrengthIndicator password={password} show={password.length > 0} />

          {/* Confirmation mot de passe */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Lock className="h-4 w-4 text-[#D4AF37]/30" strokeWidth={1.5} />
            </div>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={`w-full h-14 pl-11 pr-12 rounded-xl bg-[#0A0A0A] border ${confirmPassword && !passwordsMatch ? "border-red-500/50" : "border-[#D4AF37]/30"} text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors`}
              style={{ fontSize: "16px" }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
              ) : (
                <Eye className="h-4 w-4 text-[#555555]" strokeWidth={1.5} />
              )}
            </button>
          </div>
          {confirmPassword && !passwordsMatch && (
            <p className="text-[10px] text-red-400 font-semibold ml-1">Les mots de passe ne correspondent pas.</p>
          )}

          {/* Turnstile Widget */}
          <div className="flex justify-center mt-4">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
              onSuccess={(token) => setCaptchaToken(token)}
              options={{ theme: 'dark' }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !canSubmit}
            className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? "Création en cours..." : "Créer mon compte"}
          </button>
        </motion.form>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400 tracking-wide leading-relaxed"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {emailAlreadyExists && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 px-4 py-4 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/25 text-center"
            >
              <p className="text-[12px] text-[#D4AF37]/90 tracking-wide leading-relaxed mb-3">
                Un compte existe déjà avec cette adresse email.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-[11px] font-semibold text-[#D4AF37] hover:text-[#E5C04B] transition-colors tracking-wide uppercase py-1 px-3 rounded-lg border border-[#D4AF37]/30 hover:border-[#D4AF37]/60"
                >
                  Se connecter
                </button>
                <span className="text-[#333333] text-[10px]">ou</span>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-[11px] text-[#888888] hover:text-[#AAAAAA] transition-colors tracking-wide py-1"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-4 my-5"
        >
          <div className="flex-1 h-px bg-[#D4AF37]/20" />
          <span className="text-[11px] text-[#FFFFFF] tracking-wide uppercase">Ou continuer avec</span>
          <div className="flex-1 h-px bg-[#D4AF37]/20" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex items-center justify-center gap-5"
        >
          <button
            type="button"
            onClick={handleGoogleLogin}
            title="S'inscrire avec Google"
            className="w-14 h-14 rounded-full bg-[#0A0A0A] border border-[#D4AF37]/10 flex items-center justify-center hover:bg-[#1A1A1A] hover:border-[#D4AF37]/25 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 mb-4 flex flex-col items-center"
        >
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-[12px] text-[#FFFFFF] hover:text-[#D4AF37] transition-colors duration-300 py-2 px-4"
          >
            Déjà membre ? Se connecter
          </button>
        </motion.div>
      </div>
    </div>
  )
}
