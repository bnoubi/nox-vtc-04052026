"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { SubScreenHeader, GlassCard } from "../tab-settings"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Shield, Lock, Save, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile"

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
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
    <div className="mt-2 space-y-1.5 p-3 rounded-xl bg-black/20 border border-onyx-border/30">
      {criteria.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] font-medium">
          {c.valid ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-400" strokeWidth={2} />
          )}
          <span className={c.valid ? "text-emerald-500" : "text-muted-foreground"}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function isPasswordStrong(pwd: string) {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)
}

export function UpdatePasswordScreen({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [userEmail, setUserEmail] = useState("")

  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data?.user?.email) {
        setUserEmail(data.user.email)
      }
    }
    loadUser()
  }, [])

  const passwordsMatch = password && confirmPassword && password === confirmPassword
  const canSave = currentPassword && isPasswordStrong(password) && passwordsMatch

  async function handleSave() {
    if (!canSave || !captchaToken) return
    setLoading(true)
    
    const supabase = createClient()
    
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error("Session invalide ou expirée. Déconnectez-vous et réessayez.")
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            password: password,
            current_password: currentPassword,
            gotrue_meta_security: { captcha_token: captchaToken }
          })
        }
      )

      const data = await response.json()
      
      if (!response.ok) {
        const errorMsg = data.msg || data.message || 'Erreur inconnue'
        if (errorMsg.toLowerCase().includes("current password") || errorMsg.toLowerCase().includes("incorrect") || errorMsg.toLowerCase().includes("currentpassword")) {
          throw new Error("Le mot de passe actuel est incorrect.")
        }
        throw new Error(errorMsg)
      }

      toast.success("Mot de passe mis à jour avec succès")
      // Clear form
      setCurrentPassword("")
      setPassword("")
      setConfirmPassword("")
      onBack() 
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour du mot de passe")
    } finally {
      setLoading(false)
      // IMPORTANT : Reset du widget SEULEMENT ICI, APRÈS l'appel (dans le finally)
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    }
  }

  return (
    <motion.div key="updatePassword" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full bg-background absolute inset-0 z-10 w-full">
      <SubScreenHeader title="Mot de passe" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-6">
        
        {/* Security Banner */}
        <div className="mx-4 mb-5 mt-2 px-4 py-3 rounded-2xl bg-gold/5 border border-gold/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-gold" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Sécurité renforcée</p>
            <p className="text-[10px] text-muted-foreground">Une vérification de votre mot de passe actuel est requise.</p>
          </div>
        </div>

        <GlassCard className="mb-4">
          <div className="p-4 space-y-4">
            
            <div className="space-y-1.5 mb-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 ml-1">
                <Lock className="h-3 w-3" /> Mot de passe actuel
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 pr-12 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                  placeholder="Votre mot de passe actuel"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            <div className="h-px bg-onyx-border/50 w-full my-4" />

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 ml-1">
                <Lock className="h-3 w-3" /> Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 pr-12 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                  placeholder="Entrez le nouveau mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNew ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
              <PasswordStrengthIndicator password={password} show={password.length > 0} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 ml-1">
                <Lock className="h-3 w-3" /> Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 pr-12 py-3 rounded-xl bg-secondary/60 text-sm focus:outline-none transition-colors border ${
                    confirmPassword && !passwordsMatch 
                      ? "border-red-500/50 text-red-100" 
                      : "border-onyx-border/50 text-foreground focus:border-gold/50"
                  }`}
                  placeholder="Confirmez le nouveau mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[10px] text-red-400 font-semibold ml-1">Les mots de passe ne correspondent pas.</p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Turnstile Widget en mode visible */}
        <div className="flex justify-center mt-2 mb-2">
          <Turnstile
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
            onSuccess={(token) => setCaptchaToken(token)}
            options={{ theme: 'dark' }}
          />
        </div>

      </div>
      
      <div className="shrink-0 px-4 py-4 border-t border-onyx-border/20 bg-background z-10 w-full">
        <button
          onClick={handleSave}
          disabled={!canSave || !captchaToken || loading}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            canSave && captchaToken && !loading
              ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow active:scale-[0.98]"
              : "bg-secondary/80 text-muted-foreground cursor-not-allowed opacity-50"
          }`}
        >
          {loading ? (
            <span className="animate-pulse">Vérification...</span>
          ) : (
            <>
              <Save className="h-4 w-4" strokeWidth={1.5} />
              Mettre à jour
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
