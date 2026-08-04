"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SubScreenHeader, GlassCard } from "../tab-settings"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Save, User, Mail, Phone, BadgeCheck, MailWarning } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"
import { useNox } from "../nox-context"

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
}

export function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const { refreshUserProfile } = useNox()
  const [loading, setLoading] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [pendingEmail, setPendingEmail] = useState("")

  const [initialData, setInitialData] = useState({
    prenom: "",
    nom: "",
    email: "",
    phone: ""
  })
  const [formData, setFormData] = useState({
    prenom: "",
    nom: "",
    email: "",
    phone: ""
  })
  
  const hasChanges = JSON.stringify(initialData) !== JSON.stringify(formData)
  
  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let userEmail = user.email || ""
      let userPhone = ""
      let userPrenom = ""
      let userNom = ""

      const { data } = await supabase
        .from("user_accounts")
        .select("prenom, nom, phone")
        .eq("id", user.id)
        .single()

      if (data) {
        userPrenom = data.prenom || ""
        userNom = data.nom || ""
        userPhone = data.phone || ""
      }

      const fetchedData = { prenom: userPrenom, nom: userNom, email: userEmail, phone: userPhone }
      setInitialData(fetchedData)
      setFormData(fetchedData)
    }
    loadData()
  }, [])

  async function handleSave() {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié")

      let emailChangedLocally = false

      // Update Email via Auth if changed
      if (formData.email !== initialData.email) {
        const { error: authError } = await supabase.auth.updateUser({ email: formData.email })
        if (authError) throw authError
        
        emailChangedLocally = true
        setPendingEmail(formData.email)
      }

      // Update user_accounts
      const { error: profileError } = await supabase
        .from("user_accounts")
        .update({
          prenom: formData.prenom,
          nom: formData.nom,
          phone: formData.phone
        })
        .eq("id", user.id)

      if (profileError) throw profileError

      // Refresh global state
      await refreshUserProfile()

      // Reset local state cleanly depending on whether email changed -> confirmation pending
      setInitialData({
        ...formData,
        email: emailChangedLocally ? initialData.email : formData.email 
      })
      
      setFormData({
        ...formData,
        email: emailChangedLocally ? initialData.email : formData.email 
      })

      if (emailChangedLocally) {
        setShowEmailModal(true)
      } else {
        toast.success("Profil mis à jour avec succès")
      }

    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour")
    } finally {
      setLoading(false)
    }
  }

  const initialsToDisplay = formData.prenom && formData.nom 
    ? `${formData.prenom[0]}${formData.nom[0]}`.toUpperCase()
    : "—"

  return (
    <motion.div key="editProfile" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full bg-background absolute inset-0 z-10 w-full">
      <SubScreenHeader title="Modifier le profil" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-6">
        
        {/* Avatar */}
        <div className="flex flex-col items-center px-4 mb-6 mt-4">
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/30 via-gold/15 to-gold/5 border-2 border-gold/40 flex items-center justify-center">
              <span className="text-2xl font-bold font-heading text-gold">{initialsToDisplay}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gold flex items-center justify-center border-2 border-background">
              <BadgeCheck className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2} />
            </div>
          </div>
        </div>

        <GlassCard className="mb-4">
          <div className="p-4 space-y-4">
            {/* Prénom */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 ml-1">
                <User className="h-3 w-3" /> Prénom
              </label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                placeholder="Votre prénom"
              />
            </div>
            {/* Nom */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 ml-1">
                <User className="h-3 w-3" /> Nom
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                placeholder="Votre nom"
              />
            </div>
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 ml-1">
                <Mail className="h-3 w-3" /> Email de connexion
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                placeholder="Votre adresse email"
              />
            </div>
            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5 ml-1">
                <Phone className="h-3 w-3" /> Téléphone
              </label>
              <PhoneInput
                value={formData.phone}
                onChange={(v) => setFormData({ ...formData, phone: v })}
              />
            </div>
          </div>
        </GlassCard>

      </div>
      
      {/* Botton de validation */}
      <div className="shrink-0 px-4 py-4 border-t border-onyx-border/20 bg-background z-10 w-full">
        <button
          onClick={handleSave}
          disabled={!hasChanges || loading}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            hasChanges && !loading
              ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow active:scale-[0.98]"
              : "bg-secondary/80 text-muted-foreground cursor-not-allowed opacity-50"
          }`}
        >
          {loading ? (
            <span className="animate-pulse">Mise à jour...</span>
          ) : (
            <>
              <Save className="h-4 w-4" strokeWidth={1.5} />
              Mettre à jour le profil
            </>
          )}
        </button>
      </div>

      {/* Modal Email Confirmation */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-sm bg-onyx-card border border-onyx-border/50 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <MailWarning className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Vérifiez votre boîte mail</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Un email de confirmation a été envoyé à <strong className="text-foreground">{pendingEmail}</strong>. 
                  Votre adresse email ne sera mise à jour qu'après avoir cliqué sur le lien de confirmation.
                </p>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="w-full py-3 rounded-xl bg-secondary/80 text-foreground font-semibold hover:bg-secondary active:scale-[0.98] transition-all"
                >
                  J'ai compris
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
