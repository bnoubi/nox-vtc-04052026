"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, ArrowRight, ShieldCheck, User, Save, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"

function getVatFromStatut(statut: string): { vat_mode: 'franchise' | 'normal'; is_micro_entrepreneur: boolean } {
  if (statut === 'Micro-Entreprise') return { vat_mode: 'franchise', is_micro_entrepreneur: true }
  if (statut === 'EI' || statut === 'EIRL') return { vat_mode: 'franchise', is_micro_entrepreneur: false }
  return { vat_mode: 'normal', is_micro_entrepreneur: false }
}

export function OnboardingComponent({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Step 1 State
  const [email, setEmail] = useState("")
  const [prenom, setPrenom] = useState("")
  const [nom, setNom] = useState("")
  const [phone, setPhone] = useState("")
  const [loadingData, setLoadingData] = useState(false)

  // Step 2 State
  const [statutJuridique, setStatutJuridique] = useState("")
  const [nomEntreprise, setNomEntreprise] = useState("")
  const [siret, setSiret] = useState("")
  const [tva, setTva] = useState("")
  const [adresse, setAdresse] = useState("")
  const [codePostal, setCodePostal] = useState("")
  const [ville, setVille] = useState("")
  const [complementAdresse, setComplementAdresse] = useState("")

  // Step 3 State
  const [registreVTC, setRegistreVTC] = useState("")
  const [dateExpirationRegistre, setDateExpirationRegistre] = useState("")

  useEffect(() => {
    if (step === 1) {
      loadUserData()
    } else if (step === 2) {
      loadEnterpriseData()
    } else if (step === 3) {
      loadReglementaireData()
    }
  }, [step])

  async function loadUserData() {
    setLoadingData(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      if (user.email) setEmail(user.email)

      const { data, error } = await supabase
        .from("user_accounts")
        .select("prenom, nom, phone")
        .eq("id", user.id)
        .single()

      // Fallback sur les metadata auth si user_accounts n'a pas encore prenom/nom
      const meta = user.user_metadata ?? {}
      const resolvedPrenom = ((!error && data?.prenom) || meta.prenom || "").trim()
      const resolvedNom = ((!error && data?.nom) || meta.nom || "").trim()

      setPrenom(resolvedPrenom)
      setNom(resolvedNom)
      if (!error && data?.phone) setPhone(data.phone)

      // Prénom et nom déjà connus → passer directement à l'étape entreprise
      if (resolvedPrenom && resolvedNom) {
        setLoadingData(false)
        setStep(2)
        return
      }
    }
    setLoadingData(false)
  }

  async function loadEnterpriseData() {
    setLoadingData(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("statut_juridique, nom_entreprise, siret, tva, adresse, code_postal, ville, complement_adresse")
        .eq("user_id", user.id)
        .single()
        
      if (!error && data) {
        setStatutJuridique(data.statut_juridique || "")
        setNomEntreprise(data.nom_entreprise || "")
        setSiret(data.siret || "")
        setTva(data.tva || "")
        setAdresse(data.adresse || "")
        setCodePostal(data.code_postal || "")
        setVille(data.ville || "")
        setComplementAdresse(data.complement_adresse || "")
      }
    }
    setLoadingData(false)
  }

  async function loadReglementaireData() {
    setLoadingData(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("registre_vtc, date_registre_vtc")
        .eq("user_id", user.id)
        .single()
        
      if (!error && data) {
        setRegistreVTC(data.registre_vtc || "")
        setDateExpirationRegistre(data.date_registre_vtc || "")
      }
    }
    setLoadingData(false)
  }

  async function handleStartOnboarding() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from("user_accounts")
          .update({ onboarding_status: "in_progress" })
          .eq("id", user.id)
      }
      setStep(1)
    } catch (e) {
      console.error("[Onboarding] Entrée - Erreur de mise à jour statut:", e)
      setStep(1) // On laisse passer même si ça échoue pour ne pas bloquer l'usage
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        await supabase
          .from("user_accounts")
          .update({ 
            prenom: prenom || null, 
            nom: nom || null, 
            phone: phone || null 
          })
          .eq("id", user.id)
        setStep(2)
      }
    } catch (e) {
      console.error("[Onboarding] Profil - Erreur de sauvegarde:", e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEnterprise() {
    setLoading(true)
    setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
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
          }, { onConflict: 'user_id' })

        if (error) throw error
        setStep(3)
      }
    } catch (e) {
      console.error("[Onboarding] Entreprise - Erreur de sauvegarde:", e)
      setSaveError("Erreur lors de l'enregistrement. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveReglementaire() {
    setLoading(true)
    setSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error("Utilisateur non trouvé")

      // 1. Upsert profiles (crée la ligne si absente, met à jour sinon)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          registre_vtc: registreVTC || null,
          date_registre_vtc: dateExpirationRegistre || null,
        }, { onConflict: 'user_id' })

      if (profileError) throw profileError

      // 2. Marquer l'onboarding comme complété
      const { error: accountError } = await supabase
        .from("user_accounts")
        .update({ onboarding_status: "completed" })
        .eq("id", user.id)

      if (accountError) throw accountError

      onComplete()
    } catch (e) {
      console.error("[Onboarding] Réglementaire - Erreur:", e)
      setSaveError("Une erreur est survenue. Vérifiez votre connexion et réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden py-24">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold/5 rounded-full blur-[120px] pointer-events-none" />
      
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-md bg-onyx-card/80 backdrop-blur-xl border border-onyx-border/30 rounded-3xl p-8 relative z-10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <ShieldCheck className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>

            <h1 className="text-2xl font-bold font-heading mb-3">
              Bienvenue sur NoX VTC
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Votre compte a été créé avec succès. Pour configurer votre espace VTC de manière sécurisée, nous allons maintenant compléter les informations essentielles de votre activité VTC.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/40 border border-onyx-border/30">
                <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-gold" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F5F5F5]">Configuration de votre activité</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Quelques étapes suffisent pour renseigner vos informations professionnelles et démarrer sur NoX VTC.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartOnboarding}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gold text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-gold-light active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">Initialisation...</span>
              ) : (
                <>
                  C'est parti
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-md bg-onyx-card/80 backdrop-blur-xl border border-onyx-border/30 rounded-3xl p-8 relative z-10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <User className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>

            <h1 className="text-2xl font-bold font-heading mb-2">
              Mon Profil
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Saisissez vos informations personnelles de base.
            </p>

            <div className="space-y-4 mb-8">
              {/* Prénom */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  disabled={loadingData || loading}
                  placeholder="Jean"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Nom */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  disabled={loadingData || loading}
                  placeholder="Dupont"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Tél */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Téléphone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loadingData || loading}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Email (Readonly) */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-white/70 ml-1">Email (Connecté)</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-black/20 border border-onyx-border/30 text-sm text-muted-foreground cursor-not-allowed opacity-80"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={loading || loadingData || !prenom || !nom}
              className="w-full h-12 rounded-xl bg-gold text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-gold-light active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">Enregistrement...</span>
              ) : (
                <>
                  <Save className="h-4 w-4" strokeWidth={2} />
                  Enregistrer et continuer
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-lg bg-onyx-card/80 backdrop-blur-xl border border-onyx-border/30 rounded-3xl p-8 relative z-10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <Building2 className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>

            <h1 className="text-2xl font-bold font-heading mb-2">
              Profil Entreprise
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Renseignez les informations de votre structure.
            </p>

            <div className="space-y-4 mb-8">
              {/* Ligne 1 : Statut Juridique et SIRET */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Statut Juridique</label>
                  <select
                    value={statutJuridique}
                    onChange={(e) => setStatutJuridique(e.target.value)}
                    disabled={loadingData || loading}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23A3A3A3%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem top 50%',
                      backgroundSize: '0.65rem auto',
                    }}
                  >
                    <option value="" disabled className="bg-onyx text-muted-foreground">Sélectionner...</option>
                    <option value="Micro-Entreprise" className="bg-onyx text-white">Micro-Entreprise</option>
                    <option value="EI" className="bg-onyx text-white">EI</option>
                    <option value="EIRL" className="bg-onyx text-white">EIRL</option>
                    <option value="EURL" className="bg-onyx text-white">EURL</option>
                    <option value="SASU" className="bg-onyx text-white">SASU</option>
                    <option value="SAS" className="bg-onyx text-white">SAS</option>
                    <option value="SARL" className="bg-onyx text-white">SARL</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">SIREN / SIRET</label>
                  <input
                    type="text"
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                    disabled={loadingData || loading}
                    placeholder="9 ou 14 chiffres"
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                  />
                </div>
              </div>

              {/* Ligne 2 : Dénomination */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Dénomination Sociale</label>
                <input
                  type="text"
                  value={nomEntreprise}
                  onChange={(e) => setNomEntreprise(e.target.value)}
                  disabled={loadingData || loading}
                  placeholder="Ex: NoX Transports SAS"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Ligne 3 : TVA */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">N° de TVA Intracommunautaire</label>
                <input
                  type="text"
                  value={tva}
                  onChange={(e) => setTva(e.target.value)}
                  disabled={loadingData || loading}
                  placeholder="Optionnel ou FRXX..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              <div className="border-t border-onyx-border/30 my-4" />

              {/* Ligne 4 : Adresse */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Adresse du siège social</label>
                <PlacesAutocomplete
                  value={adresse}
                  onChange={setAdresse}
                  onPostalCode={setCodePostal}
                  onCity={setVille}
                  placeholder="123 avenue des Champs"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Ligne 5 : Complément */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Complément d'adresse</label>
                <input
                  type="text"
                  value={complementAdresse}
                  onChange={(e) => setComplementAdresse(e.target.value)}
                  disabled={loadingData || loading}
                  placeholder="Bâtiment, étage... (Optionnel)"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Ligne 6 : CP & Ville */}
              <div className="grid grid-cols-[1fr_2fr] gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Code postal</label>
                  <input
                    type="text"
                    value={codePostal}
                    onChange={(e) => setCodePostal(e.target.value)}
                    disabled={loadingData || loading}
                    placeholder="75000"
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 ml-1">Ville</label>
                  <input
                    type="text"
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    disabled={loadingData || loading}
                    placeholder="Paris"
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>
            )}
            <button
              onClick={() => { setSaveError(null); handleSaveEnterprise() }}
              disabled={loading || loadingData || !nomEntreprise || !statutJuridique || (siret.trim() !== "" && siret.replace(/\s/g, "").length !== 9 && siret.replace(/\s/g, "").length !== 14)}
              className="w-full h-12 rounded-xl bg-gold text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-gold-light active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">Enregistrement...</span>
              ) : (
                <>
                  <Save className="h-4 w-4" strokeWidth={2} />
                  Enregistrer et continuer
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-onyx-card/80 backdrop-blur-xl border border-onyx-border/30 rounded-3xl p-8 relative z-10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <ShieldCheck className="h-8 w-8 text-gold" strokeWidth={1.5} />
            </div>

            <h1 className="text-2xl font-bold font-heading mb-2">
              Réglementaire VTC
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Enregistrez vos informations d'accréditation.
            </p>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Numéro de Registre VTC</label>
                <input
                  type="text"
                  value={registreVTC}
                  onChange={(e) => setRegistreVTC(e.target.value)}
                  disabled={loadingData || loading}
                  placeholder="Ex: EVTC012..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 ml-1">Date d'expiration au registre VTC</label>
                <input
                  type="date"
                  value={dateExpirationRegistre}
                  onChange={(e) => setDateExpirationRegistre(e.target.value)}
                  disabled={loadingData || loading}
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>
            )}
            <button
              onClick={handleSaveReglementaire}
              disabled={loading || loadingData || !registreVTC}
              className="w-full h-12 rounded-xl bg-gold text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-gold-light active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">Finalisation...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  Terminer et accéder au Dashboard
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
