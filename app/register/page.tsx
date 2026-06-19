"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Turnstile } from "@marsidev/react-turnstile"

type Status =
  | { kind: "checking_session" }
  | { kind: "idle" }
  | { kind: "active_session"; onboarding_step: number; email: string }
  | { kind: "sent_new"; email: string }
  | { kind: "sent_resume"; email: string; step?: number; sent: boolean }
  | { kind: "already_completed" }

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: "checking_session" })
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setStatus({ kind: "idle" })
        return
      }
      const { data: account } = await supabase
        .from("user_accounts")
        .select("onboarding_status, onboarding_step")
        .eq("id", session.user.id)
        .maybeSingle()
      if (account?.onboarding_status === "completed") {
        router.push("/")
        return
      }
      setStatus({
        kind: "active_session",
        onboarding_step: account?.onboarding_step ?? 0,
        email: session.user.email ?? "",
      })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sendResumeMagicLink(addr: string, step?: number) {
    setError(null)
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?type=onboarding`,
          captchaToken: captchaToken || undefined,
        },
      })
      setCaptchaToken(null)
      setTurnstileKey(prev => prev + 1)
      if (error) {
        setError(error.message || JSON.stringify(error) || "Erreur inconnue")
        return
      }
      setStatus({ kind: "sent_resume", email: addr, step, sent: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : (JSON.stringify(e) || "Erreur inconnue"))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Adresse email invalide.")
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || JSON.stringify(data) || "Erreur inconnue")
        return
      }

      // CAS 3 : compte déjà finalisé (pas d'appel OTP → token Turnstile pas consommé)
      if (data.exists && data.onboarding_status === "completed") {
        setStatus({ kind: "already_completed" })
        return
      }

      // CAS 2 : compte existant en cours d'onboarding — on n'envoie pas tout de
      // suite : on bascule sur l'écran "Reprenez où vous en étiez" et c'est le
      // clic sur le bouton gold qui déclenchera l'envoi (captcha conservé).
      if (data.exists) {
        setStatus({ kind: "sent_resume", email, step: data.onboarding_step, sent: false })
        return
      }

      // CAS 1 : nouveau compte
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?type=onboarding`,
          captchaToken: captchaToken || undefined
        }
      })
      // Reset du token Turnstile (usage unique)
      setCaptchaToken(null)
      setTurnstileKey(prev => prev + 1)
      if (error) {
        setError(error?.message || JSON.stringify(error) || "Erreur inconnue")
        return
      }
      setStatus({ kind: "sent_new", email })
    } catch (e) {
      setError(e instanceof Error ? e.message : (JSON.stringify(e) || "Erreur inconnue"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center relative px-6 py-10">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-col items-center"
        >
          <span className="font-serif text-6xl leading-none" style={{ color: "#C9A84C" }}>N</span>
          <span className="text-sm tracking-widest mt-1" style={{ color: "#8B6914" }}>NoX VTC</span>
        </motion.div>

        <AnimatePresence mode="wait">
          {status.kind === "active_session" && (
            <motion.div
              key="active-session"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center mb-6">
                <Mail className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-3">Reprenez où vous en étiez</h2>
              <p className="text-[13px] text-[#888888] leading-relaxed mb-6">
                Vous avez déjà commencé votre inscription. Cliquez ci-dessous pour continuer.
              </p>

              <button
                type="button"
                onClick={() => router.push(`/?resume_step=${status.onboarding_step}`)}
                className="w-full h-12 rounded-xl bg-[#D4AF37] text-[#0A0A0A] font-semibold hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2"
              >
                Continuer mon inscription →
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#333]" />
                <span className="text-[11px] text-[#666] tracking-widest">OU</span>
                <div className="flex-1 h-px bg-[#333]" />
              </div>

              <div className="flex justify-center mb-3">
                <Turnstile
                  key={`turnstile-resume-${turnstileKey}`}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => { setCaptchaToken(null); setTurnstileKey(prev => prev + 1) }}
                  onError={() => setCaptchaToken(null)}
                  options={{ theme: 'dark', refreshExpired: 'auto' }}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400 mb-3">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => void sendResumeMagicLink(status.email, status.onboarding_step)}
                disabled={isLoading || !captchaToken || !status.email}
                className="text-[12px] text-[#888888] hover:text-[#D4AF37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Envoi..." : "Recevoir un lien par email"}
              </button>

              <div className="pt-4 text-[12px] text-[#888888] text-center">
                <button
                  type="button"
                  onClick={() => setStatus({ kind: "idle" })}
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Utiliser une autre adresse
                </button>
                {" · "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Se connecter
                </button>
              </div>
            </motion.div>
          )}

          {status.kind === "idle" && (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              <div className="text-center mb-2">
                <h1 className="text-[20px] font-semibold text-[#F5F5F5] mb-2 tracking-wide">Rejoignez NoX VTC</h1>
                <p className="text-[13px] text-[#888888]">Entrez votre adresse email pour commencer</p>
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D4AF37]/50" strokeWidth={1.5} />
                <input
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  className="w-full h-14 pl-11 pr-4 rounded-xl bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#F5F5F5] placeholder:text-[#555555] focus:outline-none focus:border-[#D4AF37]/60 transition-colors disabled:opacity-60"
                  style={{ fontSize: "16px" }}
                />
              </div>

              {/* Turnstile Widget */}
              <div className="flex justify-center mt-2 mb-2">
                <Turnstile
                  key={`turnstile-register-${turnstileKey}`}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => { setCaptchaToken(null); setTurnstileKey(prev => prev + 1) }}
                  onError={() => setCaptchaToken(null)}
                  options={{ theme: 'dark', refreshExpired: 'auto' }}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email || !captchaToken}
                className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Envoi en cours..." : "Recevoir mon lien d'accès"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="block mx-auto text-[12px] text-[#888888] hover:text-[#D4AF37] transition-colors pt-2"
              >
                Déjà un compte ? <span className="text-[#D4AF37]">Se connecter</span>
              </button>
            </motion.form>
          )}

          {status.kind === "sent_new" && (
            <motion.div
              key="sent-new"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center mb-6">
                <Mail className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-3">Lien envoyé</h2>
              <p className="text-[13px] text-[#888888] leading-relaxed mb-6">
                Un lien vous a été envoyé à <span className="text-[#D4AF37]">{status.email}</span>.<br />
                Cliquez dessus pour commencer votre inscription.
              </p>
              <div className="text-[12px] text-[#888888] text-center">
                <button
                  type="button"
                  onClick={() => setStatus({ kind: "idle" })}
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Utiliser une autre adresse
                </button>
                {" · "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Se connecter
                </button>
              </div>
            </motion.div>
          )}

          {status.kind === "sent_resume" && (
            <motion.div
              key="sent-resume"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center mb-6">
                <Mail className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-3">Reprenez où vous en étiez</h2>

              {!status.sent ? (
                <>
                  <p className="text-[13px] text-[#888888] leading-relaxed mb-5">
                    Vous avez déjà commencé votre inscription avec <span className="text-[#D4AF37]">{status.email}</span>. Validez le captcha puis cliquez ci-dessous pour recevoir votre lien d'accès.
                  </p>

                  <div className="flex justify-center mb-4">
                    <Turnstile
                      key={`turnstile-sent-resume-${turnstileKey}`}
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => { setCaptchaToken(null); setTurnstileKey(prev => prev + 1) }}
                      onError={() => setCaptchaToken(null)}
                      options={{ theme: 'dark', refreshExpired: 'auto' }}
                    />
                  </div>

                  {error && (
                    <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[12px] text-red-400 mb-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void sendResumeMagicLink(status.email, status.step)}
                    disabled={isLoading || !captchaToken}
                    className="w-full h-12 rounded-xl bg-[#D4AF37] text-[#0A0A0A] font-semibold hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Envoi en cours..." : "Continuer mon inscription →"}
                  </button>
                </>
              ) : (
                <div className="px-4 py-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[13px] text-[#D4AF37] leading-relaxed mb-6">
                  📧 Un lien vous a été envoyé à <span className="font-semibold">{status.email}</span>. Cliquez dessus pour reprendre votre inscription directement à l'étape où vous vous étiez arrêté.
                </div>
              )}

              <div className="text-[12px] text-[#888888] text-center">
                <button
                  type="button"
                  onClick={() => setStatus({ kind: "idle" })}
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Utiliser une autre adresse
                </button>
                {" · "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Se connecter
                </button>
              </div>
            </motion.div>
          )}

          {status.kind === "already_completed" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center mb-6">
                <Mail className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-semibold text-[#F5F5F5] mb-3">Compte déjà existant</h2>
              <p className="text-[13px] text-[#888888] leading-relaxed mb-6">
                Un compte existe déjà avec cet email. Connectez-vous pour accéder à votre espace.
              </p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full h-14 rounded-xl bg-[#D4AF37] text-[#0A0A0A] text-[13px] font-bold tracking-[0.15em] uppercase hover:bg-[#E5C04B] active:scale-[0.98] transition-all shadow-lg shadow-[#D4AF37]/20"
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => setStatus({ kind: "idle" })}
                className="block mx-auto text-[12px] text-[#888888] hover:text-[#D4AF37] transition-colors pt-4"
              >
                Utiliser une autre adresse
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
