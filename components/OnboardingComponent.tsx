"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, ArrowRight, ShieldCheck, User, Save, CheckCircle2, Eye, EyeOff, Search, Car, UserCheck, Lock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"

const SIREN_WHITELIST = ["000000001","000000002","000000003","000000004","000000005","000000006","000000007","000000008","000000009","000000010"]
const NAF_VTC = new Set(["4932Z", "4939B"])

function getVatFromStatut(statut: string): { vat_mode: 'franchise' | 'normal'; is_micro_entrepreneur: boolean } {
  if (statut === 'Micro-Entreprise') return { vat_mode: 'franchise', is_micro_entrepreneur: true }
  if (statut === 'EI' || statut === 'EIRL') return { vat_mode: 'franchise', is_micro_entrepreneur: false }
  return { vat_mode: 'normal', is_micro_entrepreneur: false }
}

const NATURE_JURIDIQUE_LIBELLES: Record<string, string> = {
  "1000": "EI",
  "1100": "Micro-Entreprise",
  "5306": "SNC",
  "5308": "EIRL",
  "5410": "EURL",
  "5499": "SARL",
  "5710": "SAS",
  "5720": "SASU",
  "6540": "SA",
}

function libelleNatureJuridique(code?: string): string {
  return NATURE_JURIDIQUE_LIBELLES[(code || "").trim()] || ""
}

function normalizeStatut(libelle?: string): string {
  const s = (libelle || "").toLowerCase().trim()
  if (!s) return ""
  if (s.includes("micro")) return "Micro-Entreprise"
  if (s.includes("eirl")) return "EIRL"
  if (s.includes("sasu") || s.includes("associé unique") || s.includes("associe unique")) return "SASU"
  if (s.includes("eurl") || s.includes("unipersonnelle")) return "EURL"
  if (s.includes("sas")) return "SAS"
  if (s.includes("sarl")) return "SARL"
  if (s.includes("entrepreneur individuel") || s.includes("auto-entrepreneur") || s === "ei") return "EI"
  return ""
}

interface CompanyResult {
  siren: string
  nom_complet?: string
  nom_raison_sociale?: string
  activite_principale?: string
  libelle_nature_juridique?: string
  nature_juridique?: string
  siege?: {
    adresse?: string
    code_postal?: string
    libelle_commune?: string
    complement_adresse?: string
    activite_principale?: string
  }
}

const INPUT_CLS = "w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
const PRIMARY_BTN = "w-full h-12 rounded-xl bg-gold text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-gold-light active:scale-[0.98] transition-all disabled:opacity-50"
const SECONDARY_BTN = "w-full h-12 text-sm text-muted-foreground hover:text-foreground transition-colors"

export function OnboardingComponent({ onComplete, resumeStep }: { onComplete: () => void, resumeStep?: number }) {
  // resumeStep > 0 = reprise directe sur l'étape sauvegardée. resumeStep=0 ou undefined
  // = parcours normal : slides intro (-1) puis step 1 (entreprise). Le step 0 (email/mdp)
  // n'existe plus : l'utilisateur arrive déjà authentifié via magic link ou Google OAuth.
  const router = useRouter()
  const [step, setStep] = useState<number>(resumeStep && resumeStep > 0 ? resumeStep : -1)
  const [slideIndex, setSlideIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isGoogleUser, setIsGoogleUser] = useState(false)

  // Step 7 (mot de passe — uniquement pour utilisateurs magic link)
  const [pwd, setPwd] = useState("")
  const [pwdConfirm, setPwdConfirm] = useState("")
  const [showPwdField, setShowPwdField] = useState(false)

  // Step 1
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<CompanyResult[]>([])
  const [searching, setSearching] = useState(false)

  // Step 2 (entreprise récap)
  const [statutJuridique, setStatutJuridique] = useState("")
  const [nomEntreprise, setNomEntreprise] = useState("")
  const [siret, setSiret] = useState("")
  const [tva, setTva] = useState("")
  const [adresse, setAdresse] = useState("")
  const [codePostal, setCodePostal] = useState("")
  const [ville, setVille] = useState("")
  const [complementAdresse, setComplementAdresse] = useState("")

  // Step 3 (profil)
  const [prenom, setPrenom] = useState("")
  const [nom, setNom] = useState("")
  const [phone, setPhone] = useState("")

  // Step 4 (réglementaire)
  const [registreVTC, setRegistreVTC] = useState("")
  const [dateExpirationRegistre, setDateExpirationRegistre] = useState("")

  // Step 5 (véhicule)
  const [vImmat, setVImmat] = useState("")
  const [vCategory, setVCategory] = useState("")
  const [vMarque, setVMarque] = useState("")
  const [vModele, setVModele] = useState("")

  // Step 6 (chauffeur)
  const [dPrenom, setDPrenom] = useState("")
  const [dNom, setDNom] = useState("")
  const [dEmail, setDEmail] = useState("")

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setIsGoogleUser(user.app_metadata?.provider === "google")
    })()
  }, [])

  async function saveStep(n: number) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from("user_accounts").update({
        onboarding_step: n,
        onboarding_status: "in_progress",
      }).eq("id", user.id)
    } catch (e) {
      console.error("[Onboarding] saveStep:", e)
    }
  }

  async function goToStep(n: number) {
    await saveStep(n)
    setStep(n)
  }

  useEffect(() => {
    if (step === 3) loadProfil()
    if (step === 4) loadReglementaire()
  }, [step])

  useEffect(() => {
    if (step !== 1) return
    const q = search.trim()
    if (q.length < 3) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=5`
        const res = await fetch(url, { headers: { "Accept": "application/json" } })
        const data = await res.json()
        setSearchResults(data?.results || [])
      } catch (e) {
        console.error("[Onboarding] Recherche entreprise:", e)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 600)
    return () => clearTimeout(t)
  }, [search, step])

  function startFlow() {
    void goToStep(1)
  }

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (e) {
      console.error("[Onboarding] signOut:", e)
    }
    router.push("/login")
  }

  async function handleSelectCompany(c: CompanyResult) {
    setSaveError(null)
    setLoading(true)
    try {
      const code = c.activite_principale || c.siege?.activite_principale || ""
      if (!NAF_VTC.has(code) && !SIREN_WHITELIST.includes(c.siren)) {
        setSaveError("Votre activité principale n'est pas éligible à NoX VTC (code NAF requis : 4932Z ou 4939B)")
        return
      }
      const supabase = createClient()
      const { count } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .like("siret", `${c.siren}%`)
      if ((count || 0) > 0) {
        setSaveError("Cette entreprise est déjà enregistrée. Contactez le support si vous êtes le dirigeant.")
        return
      }
      setSiret(c.siren)
      setNomEntreprise(c.nom_raison_sociale || c.nom_complet || "")
      setStatutJuridique(normalizeStatut(libelleNatureJuridique(c.nature_juridique)))
      setAdresse(c.siege?.adresse || "")
      setCodePostal(c.siege?.code_postal || "")
      setVille(c.siege?.libelle_commune || "")
      setComplementAdresse(c.siege?.complement_adresse || "")
      setSearchResults([])
      setSearch("")
      await goToStep(2)
    } catch (e) {
      console.error("[Onboarding] Sélection entreprise:", e)
      setSaveError("Erreur lors de la vérification. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEnterprise() {
    setLoading(true); setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utilisateur non authentifié")
      const vatInfo = getVatFromStatut(statutJuridique)
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          statut_juridique: statutJuridique || null,
          nom_entreprise: nomEntreprise || null,
          siret: siret || null,
          tva: tva || null,
          adresse: adresse || null,
          code_postal: codePostal || null,
          ville: ville || null,
          complement_adresse: complementAdresse || null,
          vat_mode: vatInfo.vat_mode,
          is_micro_entrepreneur: vatInfo.is_micro_entrepreneur,
        }, { onConflict: 'user_id' })
      if (error) throw error
      await goToStep(3)
    } catch (e) {
      console.error("[Onboarding] Entreprise:", e)
      setSaveError("Erreur lors de l'enregistrement. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  async function loadProfil() {
    setLoadingData(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from("user_accounts").select("prenom, nom, phone").eq("id", user.id).maybeSingle()
      const meta = user.user_metadata ?? {}
      setPrenom((data?.prenom || meta.prenom || meta.given_name || "").trim())
      setNom((data?.nom || meta.nom || meta.family_name || "").trim())
      setPhone((data?.phone || "").trim())
    }
    setLoadingData(false)
  }

  async function handleSaveProfile() {
    setLoading(true); setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("no user")
      await supabase.from("user_accounts").update({ prenom: prenom || null, nom: nom || null, phone: phone || null }).eq("id", user.id)
      await goToStep(4)
    } catch (e) {
      console.error("[Onboarding] Profil:", e)
      setSaveError("Erreur d'enregistrement.")
    } finally {
      setLoading(false)
    }
  }

  async function loadReglementaire() {
    setLoadingData(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from("profiles").select("registre_vtc, date_registre_vtc").eq("user_id", user.id).maybeSingle()
      if (data) {
        setRegistreVTC(data.registre_vtc || "")
        setDateExpirationRegistre(data.date_registre_vtc || "")
      }
    }
    setLoadingData(false)
  }

  async function handleSaveReglementaire() {
    setLoading(true); setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("no user")
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id,
        registre_vtc: registreVTC || null,
        date_registre_vtc: dateExpirationRegistre || null,
      }, { onConflict: 'user_id' })
      if (error) throw error
      await goToStep(5)
    } catch (e) {
      console.error("[Onboarding] Réglementaire:", e)
      setSaveError("Erreur d'enregistrement.")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddVehicle() {
    setLoading(true); setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("no user")
      const { error } = await supabase.from("vehicles").insert({
        user_id: user.id,
        immatriculation: vImmat || null,
        category: vCategory || null,
        marque: vMarque || null,
        modele: vModele || null,
      })
      if (error) throw error
      await goToStep(6)
    } catch (e) {
      console.error("[Onboarding] Véhicule:", e)
      setSaveError("Erreur lors de l'ajout du véhicule.")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddDriver() {
    setLoading(true); setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("no user")
      const full = `${dPrenom} ${dNom}`.trim()
      const { error } = await supabase.from("drivers").insert({
        user_id: user.id,
        prenom: dPrenom || null,
        nom: dNom || null,
        name: full || null,
        email: dEmail || null,
      })
      if (error) throw error
      await afterDriverStep()
    } catch (e) {
      console.error("[Onboarding] Chauffeur:", e)
      setSaveError("Erreur lors de l'ajout du chauffeur.")
    } finally {
      setLoading(false)
    }
  }

  async function afterDriverStep() {
    // Utilisateurs Google OAuth : skip création de mot de passe
    if (isGoogleUser) {
      await finishOnboarding()
    } else {
      await goToStep(7)
    }
  }

  async function handleSavePassword() {
    setSaveError(null)
    if (pwd.length < 8) { setSaveError("Mot de passe trop court (8 caractères minimum)."); return }
    if (pwd !== pwdConfirm) { setSaveError("Les mots de passe ne correspondent pas."); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) {
        setSaveError(error.message)
        return
      }
      await finishOnboarding()
    } catch (e) {
      console.error("[Onboarding] updatePassword:", e)
      setSaveError("Erreur lors de l'enregistrement du mot de passe.")
    } finally {
      setLoading(false)
    }
  }

  async function finishOnboarding() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("user_accounts").update({ onboarding_status: "completed" }).eq("id", user.id)
        await supabase.from("profiles").upsert({ user_id: user.id, onboarding_status: "completed" }, { onConflict: 'user_id' })
      }
    } catch (e) {
      console.error("[Onboarding] Finish:", e)
    }
    onComplete()
  }

  const card = "w-full max-w-md bg-[#1a1a1a] backdrop-blur-xl border border-[#333] rounded-3xl p-8 relative z-10"
  const cardLg = "w-full max-w-lg bg-[#1a1a1a] backdrop-blur-xl border border-[#333] rounded-3xl p-8 relative z-10"
  const tip = "p-3 rounded-xl bg-gold/10 border border-gold/20 text-xs text-gold leading-relaxed"

  const logoutBtn = (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="w-full mt-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      Se déconnecter
    </button>
  )

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden py-24">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold/5 rounded-full blur-[120px] pointer-events-none" />

      {step >= 1 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {(isGoogleUser ? [1,2,3,4,5,6] : [1,2,3,4,5,6,7]).map(i => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "bg-gold w-6" : i < step ? "bg-gold/40 w-1.5" : "bg-onyx-border w-1.5"}`} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {step === -1 && (
          <motion.div
            key="slides"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-30 bg-[#0a0a0a] flex flex-col"
          >
            {slideIndex < 2 && (
              <button
                onClick={startFlow}
                className="absolute top-6 right-6 z-40 text-xs tracking-wide text-white/70 hover:text-white"
              >
                Passer
              </button>
            )}

            <motion.div
              key={slideIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60 && slideIndex < 2) setSlideIndex(slideIndex + 1)
                else if (info.offset.x > 60 && slideIndex > 0) setSlideIndex(slideIndex - 1)
              }}
              className="flex-1 flex flex-col items-center justify-center relative"
            >
              {slideIndex === 0 && (
                <div className="absolute inset-0">
                  <img
                    src="https://images.unsplash.com/photo-1549317661-bd32c8ce0729?w=800&q=80"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute top-16 left-0 right-0 flex flex-col items-center">
                    <span className="font-serif text-6xl" style={{ color: "#C9A84C" }}>N</span>
                    <span className="text-sm tracking-widest mt-1" style={{ color: "#8B6914" }}>NoX VTC</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-32 px-8 text-center">
                    <h1 className="text-2xl font-bold font-heading mb-3 text-white">Bienvenue sur NoX VTC</h1>
                    <p className="text-sm text-white/80 leading-relaxed">La plateforme pensée par des chauffeurs, pour des chauffeurs professionnels.</p>
                  </div>
                </div>
              )}

              {slideIndex === 1 && (
                <div className="px-8 text-center max-w-md">
                  <div className="flex justify-center mb-8">
                    <svg width="80" height="96" viewBox="0 0 80 96" fill="none">
                      <rect x="12" y="10" width="56" height="76" rx="6" stroke="#C9A84C" strokeWidth="1.5" />
                      <line x1="22" y1="30" x2="58" y2="30" stroke="#C9A84C" strokeWidth="1.5" />
                      <line x1="22" y1="46" x2="58" y2="46" stroke="#C9A84C" strokeWidth="1.5" />
                      <line x1="22" y1="62" x2="42" y2="62" stroke="#C9A84C" strokeWidth="1.5" />
                      <path d="M44 22 L32 52 L42 52 L36 78 L54 44 L44 44 Z" stroke="#C9A84C" strokeWidth="1.5" fill="#C9A84C" fillOpacity="0.15" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold font-heading mb-3 text-white">Facturez en quelques secondes</h1>
                  <p className="text-sm text-white/70 leading-relaxed">Bons de commande, factures conformes DGFiP, suivi de vos courses — tout au même endroit.</p>
                </div>
              )}

              {slideIndex === 2 && (
                <div className="px-8 text-center max-w-md">
                  <div className="flex flex-col items-center mb-8">
                    <svg width="84" height="96" viewBox="0 0 84 96" fill="none">
                      <path d="M42 6 L74 18 V46 C74 66 60 82 42 90 C24 82 10 66 10 46 V18 Z" stroke="#C9A84C" strokeWidth="1.5" fill="#C9A84C" fillOpacity="0.08" />
                      <path d="M28 48 L38 58 L58 38" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="w-40 h-1.5 rounded-full bg-[#C9A84C]/15 mt-6 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: "80%", backgroundColor: "#C9A84C" }} />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold font-heading mb-3 text-white">Pilotez votre activité sereinement</h1>
                  <p className="text-sm text-white/70 leading-relaxed mb-8">Votre Score NoX vous guide pour rester en conformité et développer votre activité en toute confiance.</p>
                  <button onClick={startFlow} className="px-8 h-12 rounded-xl bg-gold text-primary-foreground font-semibold hover:bg-gold-light active:scale-[0.98] transition-all">
                    Commencer
                  </button>
                </div>
              )}
            </motion.div>

            <div className="flex justify-center gap-2 pb-4">
              {[0,1,2].map(i => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === slideIndex ? "w-6 bg-gold" : "w-1.5 bg-white/30"}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
            <div className="pb-8 px-8">{logoutBtn}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={card}
            style={{ position: 'relative', zIndex: 10 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <Building2 className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">Votre entreprise</h1>
            <p className="text-sm text-muted-foreground mb-6">Recherchez par nom ou numéro SIREN</p>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex: NoX Transports ou 123456789"
                disabled={loading}
                className={`${INPUT_CLS} pl-11`}
              />
              {searching && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">…</span>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-onyx-border/40 bg-secondary/20 divide-y divide-onyx-border/30 mb-4">
                {searchResults.map((r) => (
                  <button
                    key={r.siren}
                    onClick={() => handleSelectCompany(r)}
                    disabled={loading}
                    className="w-full text-left px-4 py-3 hover:bg-gold/5 transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-foreground truncate">{r.nom_raison_sociale || r.nom_complet}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      SIREN {r.siren}{r.siege?.libelle_commune ? ` • ${r.siege.libelle_commune}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
            <p className="text-[11px] text-muted-foreground text-center">Saisissez au moins 3 caractères pour démarrer la recherche.</p>
            {logoutBtn}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cardLg}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <Building2 className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">Vérifiez vos informations</h1>
            <p className="text-sm text-muted-foreground mb-8">Les données légales sont récupérées automatiquement. Complétez l'adresse si nécessaire.</p>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Raison sociale</label>
                <input type="text" value={nomEntreprise} disabled className={`${INPUT_CLS} opacity-70 cursor-not-allowed`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Forme juridique</label>
                  <input type="text" value={statutJuridique} disabled className={`${INPUT_CLS} opacity-70 cursor-not-allowed`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">SIREN</label>
                  <input type="text" value={siret} disabled className={`${INPUT_CLS} opacity-70 cursor-not-allowed`} />
                </div>
              </div>

              <div className="border-t border-onyx-border/30 my-2" />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Adresse du siège social</label>
                <PlacesAutocomplete
                  value={adresse}
                  onChange={setAdresse}
                  onPostalCode={setCodePostal}
                  onCity={setVille}
                  placeholder="123 avenue des Champs"
                  className={INPUT_CLS}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Complément d'adresse</label>
                <input type="text" value={complementAdresse} onChange={(e) => setComplementAdresse(e.target.value)} placeholder="Bâtiment, étage... (Optionnel)" className={INPUT_CLS} />
              </div>

              <div className="grid grid-cols-[1fr_2fr] gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Code postal</label>
                  <input type="text" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} placeholder="75000" className={INPUT_CLS} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Ville</label>
                  <input type="text" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Paris" className={INPUT_CLS} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">N° TVA intracommunautaire</label>
                <input type="text" value={tva} onChange={(e) => setTva(e.target.value)} placeholder="Optionnel — FRXX..." className={INPUT_CLS} />
              </div>
            </div>

            {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
            <button onClick={handleSaveEnterprise} disabled={loading || !nomEntreprise || !adresse} className={PRIMARY_BTN}>
              {loading ? <span className="animate-pulse">Enregistrement...</span> : <><Save className="h-4 w-4" strokeWidth={2} />Confirmer et continuer</>}
            </button>
            {logoutBtn}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={card}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <User className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">Mon profil</h1>
            <p className="text-sm text-muted-foreground mb-8">Vos coordonnées personnelles pour vos documents.</p>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Prénom</label>
                <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} disabled={loadingData || loading} placeholder="Jean" className={INPUT_CLS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Nom</label>
                <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} disabled={loadingData || loading} placeholder="Dupont" className={INPUT_CLS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Téléphone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loadingData || loading} placeholder="+33 6 00 00 00 00" className={INPUT_CLS} />
              </div>
            </div>

            <button onClick={handleSaveProfile} disabled={loading || loadingData || !prenom || !nom || !phone} className={PRIMARY_BTN}>
              {loading ? <span className="animate-pulse">Enregistrement...</span> : <><Save className="h-4 w-4" strokeWidth={2} />Enregistrer et continuer</>}
            </button>
            {logoutBtn}
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={card}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <ShieldCheck className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">Réglementaire VTC</h1>
            <p className="text-sm text-muted-foreground mb-8">Enregistrez vos informations d'accréditation.</p>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Numéro de Registre VTC</label>
                <input type="text" value={registreVTC} onChange={(e) => setRegistreVTC(e.target.value)} disabled={loadingData || loading} placeholder="Ex: EVTC012..." className={INPUT_CLS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Date d'expiration au registre VTC</label>
                <input type="date" value={dateExpirationRegistre} onChange={(e) => setDateExpirationRegistre(e.target.value)} disabled={loadingData || loading} className={`${INPUT_CLS} [color-scheme:dark]`} />
              </div>
            </div>

            {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
            <button onClick={handleSaveReglementaire} disabled={loading || loadingData || !registreVTC} className={PRIMARY_BTN}>
              {loading ? <span className="animate-pulse">Enregistrement...</span> : <><ArrowRight className="h-4 w-4" strokeWidth={2} />Continuer</>}
            </button>
            {logoutBtn}
          </motion.div>
        )}

        {step === 5 && (
          <motion.div
            key="step-5"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={card}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <Car className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">Ajoutez votre véhicule</h1>
            <p className="text-sm text-muted-foreground mb-6">Vous pourrez en ajouter d'autres plus tard depuis votre dashboard.</p>

            <div className={`${tip} mb-6`}>
              💡 Pour créer votre premier bon de commande, vous aurez besoin d'un véhicule enregistré.
            </div>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Plaque d'immatriculation</label>
                <input type="text" value={vImmat} onChange={(e) => setVImmat(e.target.value.toUpperCase())} placeholder="AB-123-CD" className={INPUT_CLS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Catégorie</label>
                <select
                  value={vCategory}
                  onChange={(e) => setVCategory(e.target.value)}
                  className={`${INPUT_CLS} appearance-none`}
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23A3A3A3%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem top 50%',
                    backgroundSize: '0.65rem auto',
                  }}
                >
                  <option value="" disabled className="bg-onyx text-muted-foreground">Sélectionner...</option>
                  <option value="berline" className="bg-onyx text-white">Berline</option>
                  <option value="van" className="bg-onyx text-white">Van</option>
                  <option value="minibus" className="bg-onyx text-white">Minibus</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Marque</label>
                  <input type="text" value={vMarque} onChange={(e) => setVMarque(e.target.value)} placeholder="Mercedes" className={INPUT_CLS} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Modèle</label>
                  <input type="text" value={vModele} onChange={(e) => setVModele(e.target.value)} placeholder="Classe E" className={INPUT_CLS} />
                </div>
              </div>
            </div>

            {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
            <button onClick={handleAddVehicle} disabled={loading || !vImmat || !vCategory || !vMarque || !vModele} className={PRIMARY_BTN}>
              {loading ? <span className="animate-pulse">Ajout...</span> : <><Save className="h-4 w-4" strokeWidth={2} />Ajouter mon véhicule</>}
            </button>
            <button type="button" onClick={() => void goToStep(6)} disabled={loading} className={SECONDARY_BTN}>Plus tard</button>
            {logoutBtn}
          </motion.div>
        )}

        {step === 6 && (
          <motion.div
            key="step-6"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={card}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <UserCheck className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">Ajoutez un chauffeur</h1>
            <p className="text-sm text-muted-foreground mb-6">Dernière étape — vous pourrez en ajouter d'autres plus tard.</p>

            <div className={`${tip} mb-6`}>
              💡 Ajoutez-vous comme chauffeur principal pour pouvoir vous affecter à vos bons de commande.
            </div>

            <button
              type="button"
              onClick={() => { setDPrenom(prenom); setDNom(nom) }}
              className="w-full mb-4 px-4 py-2.5 rounded-xl border border-gold/30 text-gold text-xs font-medium hover:bg-gold/10 transition-colors"
            >
              M'ajouter comme chauffeur
            </button>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Prénom</label>
                <input type="text" value={dPrenom} onChange={(e) => setDPrenom(e.target.value)} placeholder="Jean" className={INPUT_CLS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Nom</label>
                <input type="text" value={dNom} onChange={(e) => setDNom(e.target.value)} placeholder="Dupont" className={INPUT_CLS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Email (optionnel)</label>
                <input type="email" value={dEmail} onChange={(e) => setDEmail(e.target.value)} placeholder="chauffeur@exemple.com" className={INPUT_CLS} />
              </div>
            </div>

            {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
            <button onClick={handleAddDriver} disabled={loading || !dPrenom || !dNom} className={PRIMARY_BTN}>
              {loading ? <span className="animate-pulse">Ajout...</span> : <><CheckCircle2 className="h-4 w-4" strokeWidth={2} />Ajouter et terminer</>}
            </button>
            <button type="button" onClick={afterDriverStep} disabled={loading} className={SECONDARY_BTN}>Plus tard</button>
            {logoutBtn}
          </motion.div>
        )}

        {step === 7 && (
          <motion.div
            key="step-7"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={card}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <Lock className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">Sécurisez votre compte</h1>
            <p className="text-sm text-muted-foreground mb-6">Créez un mot de passe pour vos prochaines connexions</p>

            <div className={`${tip} mb-6`}>
              🔐 Ce mot de passe vous permettra de vous connecter directement.
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <input
                    type={showPwdField ? "text" : "password"}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="8 caractères minimum"
                    autoComplete="new-password"
                    className={`${INPUT_CLS} pl-11 pr-11`}
                  />
                  <button type="button" onClick={() => setShowPwdField(!showPwdField)} className="absolute right-4 top-1/2 -translate-y-1/2 p-1">
                    {showPwdField ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Confirmation</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <input
                    type={showPwdField ? "text" : "password"}
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    placeholder="Confirmez votre mot de passe"
                    autoComplete="new-password"
                    className={`${INPUT_CLS} pl-11`}
                  />
                </div>
              </div>
            </div>

            {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
            <button onClick={handleSavePassword} disabled={loading || pwd.length < 8 || pwd !== pwdConfirm} className={PRIMARY_BTN}>
              {loading ? <span className="animate-pulse">Enregistrement...</span> : <><CheckCircle2 className="h-4 w-4" strokeWidth={2} />Finaliser mon inscription</>}
            </button>
            <button type="button" onClick={finishOnboarding} disabled={loading} className={SECONDARY_BTN}>
              Passer cette étape
            </button>
            {logoutBtn}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
