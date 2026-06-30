"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { SubScreenHeader, GlassCard } from "../tab-settings"
import { createClient } from "@/lib/supabase/client"
import { deleteUserAccount } from "@/app/actions/account.actions"
import { toast } from "sonner"
import { AlertTriangle, Lock, LogOut, Mail } from "lucide-react"
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile"

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
}

export function DeleteAccountScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [methodLoading, setMethodLoading] = useState(false)
  const [verificationMethod, setVerificationMethod] = useState<'password' | 'otp' | null>(null)
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data?.user?.email) setUserEmail(data.user.email)
    }
    loadUser()
  }, [])

  async function fetchVerificationMethod(token: string) {
    setMethodLoading(true)
    try {
      const res = await fetch('/api/account/request-deletion-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaToken: token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la vérification')
      setVerificationMethod(data.method)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la vérification')
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setMethodLoading(false)
    }
  }

  function handleTurnstileSuccess(token: string) {
    setCaptchaToken(token)
    // Pour password : token déjà connu, on garde juste le captchaToken pour signInWithPassword
    // Pour otp / inconnu : appel API pour déterminer la méthode et envoyer l'OTP
    if (verificationMethod === 'password') return
    fetchVerificationMethod(token)
  }

  async function handleDelete() {
    if (!captchaToken) return
    setLoading(true)
    const supabase = createClient()

    try {
      if (verificationMethod === 'password') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password,
          options: { captchaToken },
        })
        if (signInError) throw new Error("Mot de passe incorrect")

      } else if (verificationMethod === 'otp') {
        const res = await fetch('/api/account/verify-deletion-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: otpCode }),
        })
        const data = await res.json()
        if (!res.ok || !data.verified) {
          throw new Error(data.error || "Code de vérification invalide ou expiré")
        }
      }

      const result = await deleteUserAccount()
      if (result?.error) throw new Error(result.error)

      await supabase.auth.signOut()
      toast.success("Votre demande de suppression a été enregistrée. Un email de confirmation vous a été envoyé.")
      window.location.href = "/login"

    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression du compte")
      setLoading(false)
    } finally {
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    }
  }

  const hasInput = verificationMethod === 'password' ? !!password : !!otpCode
  const isConfirmDisabled = !hasInput || !captchaToken || loading

  return (
    <motion.div key="deleteAccount" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full bg-background absolute inset-0 z-10 w-full">
      <SubScreenHeader title="Zone de danger" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-6">

        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 mt-2">
            <GlassCard className="border-red-900/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-red-950/10 pointer-events-none" />

              <div className="p-5 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-500" strokeWidth={1.5} />
                </div>

                <h2 className="text-base font-bold text-red-500 mb-2">Suppression définitive</h2>

                <p className="text-xs text-red-200/70 mb-5 leading-relaxed">
                  Attention, la suppression de votre compte est irréversible. Toutes vos données personnelles et votre accès à NoX VTC seront perdus.
                </p>

                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3 rounded-xl bg-red-600/20 border border-red-600/30 text-red-400 font-bold hover:bg-red-600/30 active:scale-[0.98] transition-all"
                >
                  Je veux supprimer mon compte
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="px-4 mt-2">
            <GlassCard className="border-red-900/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-red-950/10 pointer-events-none" />

              <div className="p-5">
                <p className="text-sm font-semibold text-red-400 mb-2">Confirmez votre identité</p>

                {/* Champ selon la méthode détectée */}
                {methodLoading && (
                  <p className="text-xs text-red-200/50 mb-4 animate-pulse">Vérification en cours...</p>
                )}

                {!methodLoading && verificationMethod === 'password' && (
                  <>
                    <p className="text-xs text-red-200/70 mb-4">
                      Pour des raisons de sécurité, veuillez saisir votre mot de passe actuel pour valider la suppression de <strong className="text-red-200">{userEmail}</strong>.
                    </p>
                    <div className="space-y-1.5 mb-4">
                      <label className="text-[10px] uppercase tracking-wider text-red-400/80 font-semibold flex items-center gap-1.5 ml-1">
                        <Lock className="h-3 w-3" /> Mot de passe
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-red-900/50 text-sm text-red-100 placeholder:text-red-900/40 focus:outline-none focus:border-red-600/50 transition-colors"
                        placeholder="Votre mot de passe"
                      />
                    </div>
                  </>
                )}

                {!methodLoading && verificationMethod === 'otp' && (
                  <>
                    <p className="text-xs text-red-200/70 mb-4">
                      Un code de vérification a été envoyé à <strong className="text-red-200">{userEmail}</strong>. Saisissez-le pour confirmer la suppression.
                    </p>
                    <div className="space-y-1.5 mb-4">
                      <label className="text-[10px] uppercase tracking-wider text-red-400/80 font-semibold flex items-center gap-1.5 ml-1">
                        <Mail className="h-3 w-3" /> Code reçu par email
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-red-900/50 text-sm text-red-100 placeholder:text-red-900/40 focus:outline-none focus:border-red-600/50 transition-colors tracking-widest text-center"
                        placeholder="000000"
                      />
                    </div>
                  </>
                )}

                {/* Widget Turnstile — protection captcha pour les deux flux */}
                <div className="flex justify-center mb-4">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                    onSuccess={handleTurnstileSuccess}
                    options={{ theme: 'dark' }}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={isConfirmDisabled}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      !isConfirmDisabled
                        ? "bg-red-600 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)] active:scale-[0.98]"
                        : "bg-red-950/50 text-red-900/50 cursor-not-allowed"
                    }`}
                  >
                    {loading ? (
                      <span className="animate-pulse">Traitement en cours...</span>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" strokeWidth={1.5} />
                        Confirmer la suppression
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setStep(1)
                      setVerificationMethod(null)
                      setPassword("")
                      setOtpCode("")
                    }}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

      </div>
    </motion.div>
  )
}
