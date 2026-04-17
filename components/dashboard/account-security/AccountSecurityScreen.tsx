"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  SubScreenHeader, 
  GlassCard, 
  SectionLabel, 
  SettingRow, 
  SettingItem 
} from "../tab-settings"
import { User, Lock, Trash2, AlertTriangle, ChevronRight } from "lucide-react"

// Import sub-screens
import { EditProfileScreen } from "./EditProfileScreen"
import { UpdatePasswordScreen } from "./UpdatePasswordScreen"
import { DeleteAccountScreen } from "./DeleteAccountScreen"
import { createClient } from "@/lib/supabase/client"

type AccountSubScreen = "main" | "editProfile" | "updatePassword" | "deleteAccount"

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
}

const slideBack = {
  initial: { opacity: 0, x: -60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 60 },
}

export function AccountSecurityScreen({ onBack }: { onBack: () => void }) {
  const [subScreen, setSubScreen] = useState<AccountSubScreen>("main")
  const [userInfo, setUserInfo] = useState({ name: "Chargement...", email: "" })

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from("user_accounts").select("prenom, nom").eq("id", user.id).single()
        let name = "Non renseigné"
        if (data?.prenom || data?.nom) {
          name = `${data.prenom || ""} ${data.nom || ""}`.trim()
        } else if (user.user_metadata?.full_name) {
          name = user.user_metadata.full_name
        }
        setUserInfo({ name, email: user.email || "" })
      }
    }
    loadUser()
  }, [subScreen]) // Recharger info quand on revient sur main

  const settingsItems: SettingItem[] = [
    { icon: <User className="h-4 w-4" strokeWidth={1.5} />, label: "Modifier le profil", description: `${userInfo.name}${userInfo.email ? ` • ${userInfo.email}` : ""}` },
    { icon: <Lock className="h-4 w-4" strokeWidth={1.5} />, label: "Mettre à jour le mot de passe", description: "Renforcer la sécurité de votre compte" },
  ]

  return (
    <div className="h-full overflow-hidden relative w-full">
      <AnimatePresence mode="wait">
        
        {subScreen === "main" && (
          <motion.div key="main" variants={subScreen === "main" ? slideBack : slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full absolute inset-0 w-full">
            <SubScreenHeader title="Compte & Sécurité" onBack={onBack} />
            <div className="flex-1 overflow-y-auto pb-24">
              
              <SectionLabel>Paramètres</SectionLabel>
              <GlassCard className="mb-5">
                <SettingRow item={settingsItems[0]} onPress={() => setSubScreen("editProfile")} />
                <SettingRow item={settingsItems[1]} onPress={() => setSubScreen("updatePassword")} />
              </GlassCard>

              <SectionLabel>Zone de Danger</SectionLabel>
              <div className="mx-4 mt-2 mb-5 rounded-2xl bg-red-950/20 border border-red-900/30 overflow-hidden divide-y divide-red-900/20">
                <button
                  onClick={() => setSubScreen("deleteAccount")}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-900/20 active:bg-red-900/30 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <Trash2 className="h-4 w-4 text-red-500" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-red-500 group-hover:text-red-400 transition-colors">Supprimer le compte</p>
                    <p className="text-[11px] text-red-400/60 mt-0.5 truncate">Action irréversible.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-red-500/50 shrink-0 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.5} />
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {subScreen === "editProfile" && (
          <EditProfileScreen key="editProfile" onBack={() => setSubScreen("main")} />
        )}

        {subScreen === "updatePassword" && (
          <UpdatePasswordScreen key="updatePassword" onBack={() => setSubScreen("main")} />
        )}

        {subScreen === "deleteAccount" && (
          <DeleteAccountScreen key="deleteAccount" onBack={() => setSubScreen("main")} />
        )}

      </AnimatePresence>
    </div>
  )
}
