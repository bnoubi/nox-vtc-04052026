"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, UserRoundPlus, Building2, Plus, Trash2, Contact } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { toast } from "sonner"
import type { ClientType, ClientContact, Client } from "./data"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"

interface AddClientModalProps {
  open: boolean
  onClose: () => void
}

export function AddClientModal({ open, onClose }: AddClientModalProps) {
  const { addClient } = useNox()
  const [clientType, setClientType] = useState<ClientType>("particulier")
  
  // Particulier fields
  const [civilite, setCivilite] = useState<"M." | "Mme">("M.")
  const [nom, setNom] = useState("")
  const [prenom, setPrenom] = useState("")
  
  // Professionnel fields
  const [raisonSociale, setRaisonSociale] = useState("")
  const [siren, setSiren] = useState("")
  const [tvaIntra, setTvaIntra] = useState("")
  const [contacts, setContacts] = useState<ClientContact[]>([])
  
  // Common fields
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  
  // Billing address
  const [rue, setRue] = useState("")
  const [codePostal, setCodePostal] = useState("")
  const [ville, setVille] = useState("")
  const [pays, setPays] = useState("")

  function resetForm() {
    setClientType("particulier")
    setCivilite("M.")
    setNom("")
    setPrenom("")
    setRaisonSociale("")
    setSiren("")
    setTvaIntra("")
    setContacts([])
    setPhone("")
    setEmail("")
    setRue("")
    setCodePostal("")
    setVille("")
    setPays("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const newClient: Client = {
      id: `client-${Date.now()}`,
      type: clientType,
      civilite: clientType === "particulier" ? civilite : undefined,
      nom: clientType === "particulier" ? nom : undefined,
      prenom: clientType === "particulier" ? prenom : undefined,
      raisonSociale: clientType === "professionnel" ? raisonSociale : undefined,
      siren: clientType === "professionnel" ? siren : undefined,
      tvaIntra: clientType === "professionnel" ? tvaIntra : undefined,
      contacts: clientType === "professionnel" ? contacts : undefined,
      phone,
      email,
      billingAddress: { rue, codePostal, ville, pays },
      trips: 0,
      lastTrip: "Jamais",
      notes: "Nouveau client",
    }

    let newId: string | null = null
    try {
      newId = await addClient(newClient)
    } catch (e) {
      console.error("[AddClientModal] addClient failed:", e)
    }

    if (newId) {
      toast.success("Client ajouté", {
        description: clientType === "particulier" ? `${prenom} ${nom} a été ajouté.` : `${raisonSociale} a été ajouté.`
      })
      onClose()
      setTimeout(resetForm, 300)
    } else {
      toast.error("Erreur lors de l'ajout", {
        description: "Le client n'a pas pu être enregistré. Vérifiez la console."
      })
    }
  }

  function addContact() {
    setContacts([...contacts, { id: `temp-${Date.now()}`, prenom: "", nom: "", phone: "" }])
  }

  function updateContact(index: number, field: keyof ClientContact, value: string) {
    const updated = [...contacts]
    updated[index] = { ...updated[index], [field]: value }
    setContacts(updated)
  }

  function removeContact(index: number) {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  const isParticulier = clientType === "particulier"
  const canSubmit = isParticulier 
    ? (nom.trim() && prenom.trim() && phone.trim())
    : (raisonSociale.trim() && siren.trim() && phone.trim())

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 overflow-hidden max-h-[90vh]"
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                  {isParticulier ? (
                    <UserRoundPlus className="h-4 w-4 text-gold" strokeWidth={1.5} />
                  ) : (
                    <Building2 className="h-4 w-4 text-gold" strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Nouveau Client
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    {isParticulier ? "Client particulier" : "Client professionnel"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
              >
                <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
              </button>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px bg-onyx-border/30" />

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              
              {/* Import from Contacts Button */}
              <button
                type="button"
                onClick={() => {
                  // Simulate importing from phone contacts
                  // In a real app, this would use the Contacts API
                  if (isParticulier) {
                    setPrenom("Jean")
                    setNom("Dupont")
                    setPhone("+33 6 12 34 56 78")
                    setEmail("jean.dupont@email.com")
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-onyx-card border border-dashed border-gold/30 text-gold text-xs font-medium hover:bg-gold/5 hover:border-gold/50 transition-all"
              >
                <Contact className="h-4 w-4" strokeWidth={1.5} />
                Importer depuis les contacts
              </button>
              
              {/* Type Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Type de client
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "particulier" as ClientType, label: "Particulier", icon: <UserRoundPlus className="h-3.5 w-3.5" strokeWidth={1.5} /> },
                    { value: "professionnel" as ClientType, label: "Professionnel", icon: <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} /> },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setClientType(t.value)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-all",
                        clientType === t.value
                          ? "bg-gold/15 border-gold/40 text-gold"
                          : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-gold/20"
                      )}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Identity Section */}
              {isParticulier ? (
                <>
                  {/* Civilité */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Civilité
                    </label>
                    <select
                      value={civilite}
                      onChange={(e) => setCivilite(e.target.value as "M." | "Mme")}
                      className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors"
                    >
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                  </div>

                  {/* Nom & Prénom */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Prénom *
                      </label>
                      <input
                        type="text"
                        required
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Alexandre"
                        className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Nom *
                      </label>
                      <input
                        type="text"
                        required
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Laurent"
                        className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Raison Sociale */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Raison Sociale *
                    </label>
                    <input
                      type="text"
                      required
                      value={raisonSociale}
                      onChange={(e) => setRaisonSociale(e.target.value)}
                      placeholder="Entreprise SAS"
                      className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>

                  {/* SIREN & TVA */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        N° SIREN *
                      </label>
                      <input
                        type="text"
                        required
                        value={siren}
                        onChange={(e) => setSiren(e.target.value)}
                        placeholder="123456789"
                        maxLength={9}
                        className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        TVA Intracom.
                      </label>
                      <input
                        type="text"
                        value={tvaIntra}
                        onChange={(e) => setTvaIntra(e.target.value)}
                        placeholder="FR12345678901"
                        className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Contacts / Passagers associés */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Contacts / Passagers
                      </label>
                      <button
                        type="button"
                        onClick={addContact}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 border border-gold/30 text-gold text-[10px] font-medium hover:bg-gold/20 transition-colors"
                      >
                        <Plus className="h-3 w-3" strokeWidth={2} />
                        Ajouter
                      </button>
                    </div>
                    
                    {contacts.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/70 italic py-2">
                        Aucun contact ajouté
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact, index) => (
                          <div key={contact.id} className="p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-gold font-medium">Contact {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeContact(index)}
                                className="p-1 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <input
                                type="text"
                                value={contact.prenom}
                                onChange={(e) => updateContact(index, "prenom", e.target.value)}
                                placeholder="Prénom"
                                className="w-full px-3 py-2 rounded-lg bg-background border border-onyx-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                              />
                              <input
                                type="text"
                                value={contact.nom}
                                onChange={(e) => updateContact(index, "nom", e.target.value)}
                                placeholder="Nom"
                                className="w-full px-3 py-2 rounded-lg bg-background border border-onyx-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                              />
                            </div>
                            <input
                              type="tel"
                              value={contact.phone}
                              onChange={(e) => updateContact(index, "phone", e.target.value)}
                              placeholder="Téléphone"
                              className="w-full px-3 py-2 rounded-lg bg-background border border-onyx-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Common: Phone & Email */}
              <div className="pt-2 border-t border-onyx-border/30">
                <p className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">
                  Coordonnées
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Téléphone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div className="pt-2 border-t border-onyx-border/30">
                <p className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3">
                  Adresse de Facturation
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Rue et Numéro
                    </label>
                    <PlacesAutocomplete
                      value={rue}
                      onChange={setRue}
                      onPostalCode={setCodePostal}
                      onCity={setVille}
                      onCountry={setPays}
                      placeholder="8 Rue de Rivoli"
                      className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Code Postal
                      </label>
                      <input
                        type="text"
                        value={codePostal}
                        onChange={(e) => setCodePostal(e.target.value)}
                        placeholder="75001"
                        maxLength={5}
                        className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Ville
                      </label>
                      <input
                        type="text"
                        value={ville}
                        onChange={(e) => setVille(e.target.value)}
                        placeholder="Paris"
                        className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Pays
                    </label>
                    <input
                      type="text"
                      value={pays}
                      onChange={(e) => setPays(e.target.value)}
                      placeholder="France"
                      className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "w-full py-3.5 rounded-2xl text-sm font-bold transition-all",
                  canSubmit
                    ? "bg-gold text-primary-foreground hover:bg-gold-light active:scale-[0.98] gold-glow-sm"
                    : "bg-onyx-card text-muted-foreground border border-onyx-border/50 cursor-not-allowed"
                )}
              >
                Enregistrer
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
