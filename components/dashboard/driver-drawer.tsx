"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, User, Phone, FileText, Calendar, Trash2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Driver } from "./data"

function getExpirationStatus(dateStr: string): { label: string; cls: string } {
  if (!dateStr) return { label: "", cls: "" }
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: "Expiré", cls: "bg-red-500/15 text-red-400 border-red-500/25" }
  if (diff <= 30) return { label: `${diff}j`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" }
  return { label: "OK", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" }
}

interface DriverDrawerProps {
  open: boolean
  driver: Driver | null // null = Add mode, Driver = Edit mode
  onClose: () => void
  onSave: (data: { nom: string; prenom: string; phone: string; cartePro: string; expirationCarte: string; apacExpiration: string; rcProExpiration: string }) => void
  onDelete?: (driver: Driver) => void
}

export function DriverDrawer({ open, driver, onClose, onSave, onDelete }: DriverDrawerProps) {
  const isEditMode = !!driver
  const [nom, setNom] = useState("")
  const [prenom, setPrenom] = useState("")
  const [phone, setPhone] = useState("")
  const [cartePro, setCartePro] = useState("")
  const [expirationCarte, setExpirationCarte] = useState("")
  const [apacExpiration, setApacExpiration] = useState("")
  const [rcProExpiration, setRcProExpiration] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      if (driver) {
        // Edit mode: pre-fill
        const parts = driver.name.split(" ")
        setPrenom(parts[0] || "")
        setNom(parts.slice(1).join(" ") || "")
        setPhone("+33 6 00 00 00 00")
        setCartePro("VTC-" + driver.id.padStart(6, "0"))
        setExpirationCarte(driver.carteProExpiration || "")
        setApacExpiration(driver.apacExpiration || "")
        setRcProExpiration(driver.rcProExpiration || "")
      } else {
        // Add mode: empty
        setNom("")
        setPrenom("")
        setPhone("")
        setCartePro("")
        setExpirationCarte("")
        setApacExpiration("")
        setRcProExpiration("")
      }
      setConfirmDelete(false)
      setSaved(false)
    }
  }, [driver, open])

  const carteStatus = getExpirationStatus(expirationCarte)
  const apacStatus = getExpirationStatus(apacExpiration)
  const rcProStatus = getExpirationStatus(rcProExpiration)
  const canSave = nom.trim() && prenom.trim()

  function handleSave() {
    if (!canSave) return
    setSaved(true)
    setTimeout(() => {
      onSave({ nom, prenom, phone, cartePro, expirationCarte, apacExpiration, rcProExpiration })
      toast(isEditMode ? "Mise à jour effectuée" : "Chauffeur ajouté", {
        description: `${prenom} ${nom}`,
        duration: 2000,
      })
      setSaved(false)
    }, 800)
  }

  function handleDelete() {
    if (!driver || !onDelete) return
    onDelete(driver)
    toast("Élément supprimé", {
      description: driver.name,
      duration: 2000,
    })
    setConfirmDelete(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-end justify-center"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="relative w-full max-w-md bg-[#0E0E0E]/95 backdrop-blur-2xl rounded-t-3xl border-t border-[#D4AF37]/25 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#D4AF37]/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
                  <User className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#D4AF37] tracking-wide">
                    {isEditMode ? "Modifier le Profil" : "Nouveau Chauffeur"}
                  </h2>
                  <p className="text-[10px] text-[#A1A1AA]">Chauffeur VTC</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5 text-[#D4AF37]" strokeWidth={2.5} />
              </button>
            </div>

            <div className="mx-5 h-px bg-[#D4AF37]/10 shrink-0" />

            {/* Scrollable Form */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* NOM */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 block">
                  NOM
                </label>
                <input
                  type="text"
                  placeholder="Dupont"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                />
              </div>

              {/* PRENOM */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 block">
                  PRÉNOM
                </label>
                <input
                  type="text"
                  placeholder="Jean"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                />
              </div>

              {/* TELEPHONE */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3 w-3" strokeWidth={1.5} />
                  TÉLÉPHONE
                </label>
                <input
                  type="tel"
                  placeholder="+33 6 00 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                />
              </div>

              {/* NUMERO CARTE PRO VTC */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3 w-3" strokeWidth={1.5} />
                  NUMÉRO CARTE PRO VTC
                </label>
                <input
                  type="text"
                  placeholder="VTC-000000"
                  value={cartePro}
                  onChange={(e) => setCartePro(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] font-mono placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                />
              </div>

              {/* EXPIRATION CARTE PRO VTC */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" strokeWidth={1.5} />
                    EXPIRATION CARTE PRO VTC
                  </label>
                  {carteStatus.label && (
                    <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border", carteStatus.cls)}>
                      {carteStatus.label}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={expirationCarte}
                  onChange={(e) => setExpirationCarte(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D4AF37]/50 transition-colors [color-scheme:dark]"
                />
              </div>

              {/* EXPIRATION VISITE MÉDICALE / APAC */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" strokeWidth={1.5} />
                    EXPIRATION VISITE MÉDICALE
                  </label>
                  {apacStatus.label && (
                    <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border", apacStatus.cls)}>
                      {apacStatus.label}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={apacExpiration}
                  onChange={(e) => setApacExpiration(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D4AF37]/50 transition-colors [color-scheme:dark]"
                />
                <p className="text-[9px] text-[#666] mt-1">APAC : Attestation Préfectorale d&apos;Aptitude Physique</p>
              </div>

              {/* EXPIRATION RC PRO */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" strokeWidth={1.5} />
                    EXPIRATION RC PRO
                  </label>
                  {rcProStatus.label && (
                    <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border", rcProStatus.cls)}>
                      {rcProStatus.label}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={rcProExpiration}
                  onChange={(e) => setRcProExpiration(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D4AF37]/50 transition-colors [color-scheme:dark]"
                />
                <p className="text-[9px] text-[#666] mt-1">Responsabilité Civile Professionnelle</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-8 pt-3 border-t border-[#D4AF37]/10 space-y-2.5 shrink-0">
              <button
                onClick={handleSave}
                disabled={saved || !canSave}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-2",
                  saved
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                    : canSave
                      ? "bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#E5C44D]"
                      : "bg-[#333] text-[#666] cursor-not-allowed"
                )}
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                    {isEditMode ? "Mise à jour effectuée" : "Chauffeur ajouté"}
                  </>
                ) : (
                  "Enregistrer"
                )}
              </button>

              {/* Delete - only in edit mode */}
              {isEditMode && onDelete && (
                <AnimatePresence mode="wait">
                  {!confirmDelete ? (
                    <motion.button
                      key="delete-trigger"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-red-400/70 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Supprimer ce chauffeur
                    </motion.button>
                  ) : (
                    <motion.div
                      key="delete-confirm"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 space-y-2"
                    >
                      <p className="text-xs text-red-300 text-center leading-relaxed">
                        {"Souhaitez-vous retirer cet élément de votre flotte NoX ?"}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 py-2 rounded-xl bg-[#1A1A1A] border border-[#333] text-xs font-medium text-[#A1A1AA] hover:border-[#555] transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleDelete}
                          className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/25 active:scale-[0.97] transition-all"
                        >
                          Confirmer
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
