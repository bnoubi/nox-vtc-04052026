"use client"

import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, AlertTriangle, CheckCircle2, Clock, ShieldCheck, User, Car, Building2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { type MotorType } from "./data"
import { getPlanLimits } from "@/lib/plans"
import { useNox } from "./nox-context"

interface DocumentIssue {
  type: "expired" | "warning" | "critical"
  label: string
  daysRemaining: number
  documentType: string
  entityType: "driver" | "vehicle" | "enterprise"
  entityId: string
  field: string
}

function getScoreColor(score: number): string {
  if (score >= 95) return "#D4AF37" // Or/Gold
  if (score >= 80) return "#3B82F6" // Bleu
  if (score >= 60) return "#22C55E" // Vert
  if (score >= 40) return "#EAB308" // Jaune
  if (score >= 20) return "#F97316" // Orange
  return "#EF4444" // Rouge
}

function getScoreMessage(score: number): string {
  if (score >= 95) return "Excellence NoX"
  if (score >= 80) return "Profil solide"
  if (score >= 60) return "Profil opérationnel"
  if (score >= 40) return "En progression, éléments critiques manquants"
  if (score >= 20) return "Base créée, conformité insuffisante"
  return "Profil non sécurisé"
}

function calculateVehicleAge(datePremiereImmat: string): number {
  if (!datePremiereImmat) return 0
  const startDate = new Date(datePremiereImmat)
  const today = new Date()
  
  let years = today.getFullYear() - startDate.getFullYear()
  const monthDiff = today.getMonth() - startDate.getMonth()
  const dayDiff = today.getDate() - startDate.getDate()
  
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--
  }
  return years
}

function getVehicleAgeStatus(years: number, motorType: MotorType): { status: "ok" | "warning" | "alert" | "critical"; label: string } {
  // Pas de limite d'âge pour hybride et électrique
  if (motorType === "hybride" || motorType === "electrique") {
    return { status: "ok", label: "Aucune limite d'âge" }
  }
  // Pour thermiques (diesel/essence) - Algorithme 5/6/7
  if (years >= 7) return { status: "critical", label: "Score à 0 - Véhicule >= 7 ans" }
  if (years >= 6) return { status: "alert", label: "Changement impératif" }
  if (years >= 5) return { status: "warning", label: "Alerte anticipation" }
  return { status: "ok", label: "Conforme" }
}

interface GuardianScoreProps {
  onNavigateToEntity?: (entityType: "driver" | "vehicle" | "enterprise", entityId: string, field: string) => void
}

export function GuardianScore({ onNavigateToEntity }: GuardianScoreProps) {
  const [showDetails, setShowDetails] = useState(false)
  const { drivers, vehicles, plan, enterprise, userProfile } = useNox()
  const limits = getPlanLimits(plan)

  const visibleDrivers = drivers.slice(0, limits.drivers)
  const visibleVehicles = vehicles.slice(0, limits.vehicles)

  function getValidityScore(dateStr: string | undefined | null, weight: number): number {
    if (!dateStr) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(dateStr)
    if (isNaN(targetDate.getTime())) return 0
    if (targetDate.getTime() < today.getTime()) return weight * 0.2 // expiré => 20%
    return weight
  }

  const { score, blocks, issues } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const issuesList: DocumentIssue[] = []

    function checkDate(dateStr: string | undefined | null, label: string, docType: string, entityType: "driver" | "vehicle" | "enterprise", entityId: string, field: string) {
      if (!dateStr) {
         issuesList.push({ type: "critical", label, daysRemaining: 0, documentType: `${docType} non renseigné`, entityType, entityId, field })
         return;
      }
      const expDate = new Date(dateStr)
      if (isNaN(expDate.getTime())) return;
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        issuesList.push({ type: "expired", label, daysRemaining: diffDays, documentType: docType, entityType, entityId, field })
      } else if (diffDays <= 30) {
        issuesList.push({ type: "warning", label, daysRemaining: diffDays, documentType: docType, entityType, entityId, field })
      }
    }

    // === BLOCK 1: Profil Entreprise (20 pts) ===
    let b1Score = 0;
    // Complétude (6 pts) : On utilise les champs réels du userProfile et enterprise (pas d'invention)
    if (userProfile?.prenom && userProfile?.nom) b1Score += 2;
    if (userProfile?.phone || enterprise?.phone) b1Score += 1;
    // Le minimum "profil entreprise" est basé sur la présence des coordonnées de base
    if (enterprise?.name && enterprise?.siren && enterprise?.adresse) b1Score += 3;
    
    // Validité (14 pts) : Registre VTC (seule composante réglementaire directe entreprise)
    if (enterprise?.registreVTC) b1Score += 5;
    if (enterprise?.dateRegistre) {
       b1Score += getValidityScore(enterprise.dateRegistre, 9);
       checkDate(enterprise.dateRegistre, "Entreprise", "Registre VTC", "enterprise", "1", "dateRegistre");
    } else {
       checkDate(null, "Entreprise", "Registre VTC", "enterprise", "1", "dateRegistre");
    }

    // === BLOCK 2: Chauffeurs Actifs (40 pts max) ===
    let b2Total = 0;
    // Ne calculer que sur les chauffeurs ACTIFS (champ TS: online = boolean)
    const activeDrivers = visibleDrivers.filter(d => Boolean(d.online));
    activeDrivers.forEach((d: any) => {
       let dScore = 0; // Sur 100
       
       // Complétude = 30 pts
       // Redistribution propre car "numero_apac" et "numero_rc_pro" n'existent pas encore dans l'interface TS Driver actuelle.
       // Identity(prenom/nom) = ~10, Telephone = ~5, Carte VTC = ~15 (somme = 30 points)
       if (d.name) dScore += 10;
       if (d.phone) dScore += 5;
       if (d.carteProNumber) dScore += 15;

       // Validité = 70 pts
       // Champs réels dispos: carteProExpiration, apacExpiration, rcProExpiration
       // date_expiration_carte_vtc valide = 30pts
       dScore += getValidityScore(d.carteProExpiration, 30);
       checkDate(d.carteProExpiration, `Carte VTC - ${d.name}`, "Carte VTC", "driver", d.id, "carteProExpiration");

       // date_expiration_apac valide = 25pts
       dScore += getValidityScore(d.apacExpiration, 25);
       checkDate(d.apacExpiration, `APAC - ${d.name}`, "Attest. Préfectorale (APAC)", "driver", d.id, "apacExpiration");

       // date_expiration_rc_pro valide = 15pts
       dScore += getValidityScore(d.rcProExpiration, 15);
       checkDate(d.rcProExpiration, `RC Pro - ${d.name}`, "RC Pro", "driver", d.id, "rcProExpiration");

       b2Total += dScore;
    });
    // Moyenne des chauffeurs actifs, ramenée sur 40 (dScore sur 100 * 0.40 = 40 max)
    const b2Score = activeDrivers.length > 0 ? (b2Total / activeDrivers.length) * 0.4 : 0;

    // === BLOCK 3: Véhicules (40 pts max) ===
    let b3Total = 0;
    visibleVehicles.forEach((v: any) => {
       let vScore = 0; // Sur 100
       
       // Complétude = 30 pts (6 champs à 5 pts - on adapte pour category)
       if (v.marque) vScore += 5;
       if (v.modele) vScore += 5;
       if (v.type_energie) vScore += 5;
       if (v.immatriculation) vScore += 5;
       if (v.date_mise_en_circulation) vScore += 5;
       if (v.category) vScore += 5;

       // Validité = 70 pts (Age: 25, Assurance: 25, CT: 20)
       vScore += getValidityScore(v.assuranceTransportExpiration, 25);
       checkDate(v.assuranceTransportExpiration, `Assurance - ${v.immatriculation || v.modele}`, "Assurance au Tiers + ATO", "vehicle", v.id, "assuranceTransportExpiration");

       vScore += getValidityScore(v.controleTechniqueExpiration, 20);
       checkDate(v.controleTechniqueExpiration, `CT - ${v.immatriculation || v.modele}`, "Contrôle Technique VTC", "vehicle", v.id, "controleTechniqueExpiration");

       // Règle d'éligibilité d'Âge (25 pts)
       if (v.type_energie === 'hybride' || v.type_energie === 'electrique') {
          vScore += 25; // Pas de pénalité d'âge
       } else if (v.date_mise_en_circulation) {
          const age = calculateVehicleAge(v.date_mise_en_circulation);
          if (age <= 7) {
             vScore += 25;
          } else {
             issuesList.push({ type: "critical", label: `${v.modele || ''} - ${v.immatriculation || ''}`, daysRemaining: 0, documentType: `Véhicule thermique > 7 ans`, entityType: "vehicle", entityId: v.id, field: "datePremiereImmat" });
          }
       } else {
          // Date inconnue = 0% de la sous-note âge
          issuesList.push({ type: "critical", label: `${v.modele || ''} - ${v.immatriculation || ''}`, daysRemaining: 0, documentType: `Date mise en circulation manquante`, entityType: "vehicle", entityId: v.id, field: "datePremiereImmat" });
       }

       b3Total += vScore;
    });
    // Moyenne des véhicules, ramenée sur 40 (vScore sur 100 * 0.40 = 40 max)
    const b3Score = visibleVehicles.length > 0 ? (b3Total / visibleVehicles.length) * 0.4 : 0;

    // Calcul du score global : bornage strict 0-100 et arrondi propre
    let finalScore = Math.round(b1Score + b2Score + b3Score);
    if (!Number.isFinite(finalScore)) finalScore = 0;
    finalScore = Math.max(0, Math.min(100, finalScore));

    issuesList.sort((a, b) => {
      const priority = { critical: 0, expired: 1, warning: 2 }
      if (priority[a.type] !== priority[b.type]) return priority[a.type] - priority[b.type]
      return a.daysRemaining - b.daysRemaining
    });

    return { 
       score: finalScore,
       blocks: { b1: Math.round(b1Score), b2: Math.round(b2Score), b3: Math.round(b3Score) },
       issues: issuesList 
    };
  }, [visibleDrivers, visibleVehicles, enterprise, userProfile])

  const scoreColor = getScoreColor(score)
  const scoreMessage = getScoreMessage(score)

  function handleIssueClick(issue: DocumentIssue) {
    if (onNavigateToEntity) {
      setShowDetails(false)
      onNavigateToEntity(issue.entityType, issue.entityId, issue.field)
    }
  }

  return (
    <section className="px-4 w-full">
      <div className="mx-auto max-w-md">
        {/* Compact horizontal score bar */}
        <button
          onClick={() => setShowDetails(true)}
          className="group w-full flex items-center gap-3 px-3 bg-[#1a1a1a] rounded-[12px] active:scale-[0.99] transition-transform"
          style={{
            height: 52,
            border: `1px solid ${scoreColor}`,
          }}
          aria-label="Voir les détails de conformité"
        >
          <ShieldCheck className="h-5 w-5 flex-shrink-0" style={{ color: scoreColor }} strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground flex-shrink-0">Score NoX</span>

          <div className="flex-1 h-2 rounded-full bg-[#0f0f0f] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1.0, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                backgroundColor: scoreColor,
                boxShadow: `0 0 8px ${scoreColor}40`,
              }}
            />
          </div>

          <span className="text-sm font-bold flex-shrink-0" style={{ color: scoreColor }}>
            {score}%
          </span>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" strokeWidth={2} />
        </button>

        {/* Contextual message */}
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-[11px] font-medium mt-2 px-1"
          style={{ color: scoreColor }}
        >
          {scoreMessage}
        </motion.p>
      </div>

      {/* Details Drawer */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70]"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowDetails(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-3xl bg-[#0E0E0E] border-t border-[#D4AF37]/30 overflow-hidden"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-[#333]" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    score >= 60 ? "bg-emerald-500/15" : score >= 40 ? "bg-[#D4AF37]/15" : "bg-red-500/15"
                  )}>
                    <ShieldCheck
                      className={cn(
                        "h-5 w-5",
                        score >= 60 ? "text-emerald-500" : score >= 40 ? "text-[#D4AF37]" : "text-red-500"
                      )}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#F5F5F5]">
                      Guardian NoX
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {issues.length === 0
                        ? "Conformité validée"
                        : `${issues.length} élément${issues.length > 1 ? "s" : ""} à surveiller`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="w-8 h-8 rounded-full border border-[#333] flex items-center justify-center hover:bg-[#1A1A1A] transition-colors"
                >
                  <X className="h-4 w-4 text-[#A1A1AA]" strokeWidth={2} />
                </button>
              </div>

              <div className="px-5 mb-5 mt-1">
                  <div className="flex justify-between items-center bg-[#1A1A1A] p-3 rounded-xl border border-[#333]">
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Profil</p>
                      <p className="text-sm font-bold text-foreground">{blocks.b1}<span className="text-[#A1A1AA] text-xs font-normal">/20</span></p>
                    </div>
                    <div className="w-px h-8 bg-[#333]"></div>
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Chauffeurs</p>
                      <p className="text-sm font-bold text-foreground">{blocks.b2}<span className="text-[#A1A1AA] text-xs font-normal">/40</span></p>
                    </div>
                    <div className="w-px h-8 bg-[#333]"></div>
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Véhicules</p>
                      <p className="text-sm font-bold text-foreground">{blocks.b3}<span className="text-[#A1A1AA] text-xs font-normal">/40</span></p>
                    </div>
                  </div>
                </div>

              <div className="px-5 pb-8 max-h-[50vh] overflow-y-auto space-y-3">
                {issues.length === 0 ? (
                  <div className="flex flex-col items-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" strokeWidth={1} />
                    <p className="text-sm text-[#F5F5F5] font-medium">Parfaite conformité</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Aucun document n&apos;expire dans les 30 prochains jours.
                    </p>
                  </div>
                ) : (
                  issues.map((issue: DocumentIssue, i: number) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleIssueClick(issue)}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border w-full text-left transition-all active:scale-[0.98]",
                        issue.type === "critical"
                          ? "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15"
                          : issue.type === "expired"
                            ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/15"
                            : "bg-[#D4AF37]/10 border-[#D4AF37]/30 hover:bg-[#D4AF37]/15"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                        issue.type === "critical" ? "bg-rose-500/20" : issue.type === "expired" ? "bg-red-500/20" : "bg-[#D4AF37]/20"
                      )}>
                        {issue.entityType === "enterprise" ? (
                          <Building2 className={cn("h-4 w-4", issue.type === "critical" ? "text-rose-500" : issue.type === "expired" ? "text-red-500" : "text-[#D4AF37]")} strokeWidth={1.5} />
                        ) : issue.entityType === "driver" ? (
                          <User className={cn("h-4 w-4", issue.type === "critical" ? "text-rose-500" : issue.type === "expired" ? "text-red-500" : "text-[#D4AF37]")} strokeWidth={1.5} />
                        ) : (
                          <Car className={cn("h-4 w-4", issue.type === "critical" ? "text-rose-500" : issue.type === "expired" ? "text-red-500" : "text-[#D4AF37]")} strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          issue.type === "critical" ? "text-rose-400" : issue.type === "expired" ? "text-red-400" : "text-[#F5F5F5]"
                        )}>
                          {issue.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {issue.documentType}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-xs font-bold",
                          issue.type === "critical" ? "text-rose-500" : issue.type === "expired" ? "text-red-500" : "text-[#D4AF37]"
                        )}>
                          {issue.type === "critical"
                            ? "Score 0"
                            : issue.type === "expired"
                              ? "Expiré"
                              : `${issue.daysRemaining}j`}
                        </p>
                        {issue.type === "expired" && issue.daysRemaining < 0 && (
                          <p className="text-[10px] text-red-400/70">
                            depuis {Math.abs(issue.daysRemaining)}j
                          </p>
                        )}
                      </div>
                    </motion.button>
                  ))
                )}
              </div>

              {/* Note */}
              {issues.some(i => i.type === "critical" || i.type === "expired") && (
                <div className="px-5 pb-5">
                  <p className="text-[10px] text-muted-foreground text-center">
                    Appuyez sur une alerte pour accéder directement au profil concerné
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
