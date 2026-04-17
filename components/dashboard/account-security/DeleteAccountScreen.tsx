"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { SubScreenHeader, GlassCard } from "../tab-settings"
import { createClient } from "@/lib/supabase/client"
import { deleteUserAccount } from "@/app/actions/account.actions"
import { toast } from "sonner"
import { AlertTriangle, Lock, LogOut } from "lucide-react"

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
}

export function DeleteAccountScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState("")
  const [userEmail, setUserEmail] = useState("")

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

  async function handleDelete() {
    setLoading(true)
    const supabase = createClient()

    try {
      // 1. Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      })

      if (signInError) {
        throw new Error("Mot de passe incorrect")
      }

      // 2. Call Server Action to delete user
      const result = await deleteUserAccount()

      if (result?.error) {
        throw new Error(result.error)
      }

      // 3. Clear session and redirect
      await supabase.auth.signOut()
      toast.success("Votre compte a été définitivement supprimé.")
      
      // La redirection est gérée naturellement après le signOut 
      // si l'application possède une logique d'écoute au niveau root,
      // sinon on force côté client :
      window.location.href = "/login"

    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression du compte")
      setLoading(false)
    }
  }

  return (
    <motion.div key="deleteAccount" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full bg-background absolute inset-0 z-10 w-full">
      <SubScreenHeader title="Zone de danger" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-6">
        
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 mt-2">
            <GlassCard className="border-red-900/30 overflow-hidden relative">
              {/* Fond d'alerte */}
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
                <p className="text-xs text-red-200/70 mb-4">
                  Pour des raisons de sécurité, veuillez saisir votre mot de passe actuel pour valider la suppression définitive de <strong className="text-red-200">{userEmail}</strong>.
                </p>

                <div className="space-y-1.5 mb-6">
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

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={!password || loading}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      password && !loading
                        ? "bg-red-600 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)] active:scale-[0.98]"
                        : "bg-red-950/50 text-red-900/50 cursor-not-allowed"
                    }`}
                  >
                    {loading ? (
                      <span className="animate-pulse">Suppression en cours...</span>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" strokeWidth={1.5} />
                        Confirmer la suppression
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setStep(1)}
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
