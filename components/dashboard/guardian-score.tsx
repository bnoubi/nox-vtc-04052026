"use client"

import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, AlertTriangle, CheckCircle2, Clock, ShieldCheck, User, Car } from "lucide-react"
import { cn } from "@/lib/utils"
import { type MotorType, PLAN_LIMITS } from "./data"
import { useNox } from "./nox-context"

interface DocumentIssue {
  type: "expired" | "warning" | "critical"
  label: string
  daysRemaining: number
  documentType: string
  entityType: "driver" | "vehicle"
  entityId: string
  field: string
}

function getScoreColor(score: number): string {
  if (score === -1) return "#333333" // Gray for N/A
  if (score >= 100) return "#10B981" // Emerald green
  if (score >= 70) return "#D4AF37" // Gold/Amber
  if (score > 0) return "#F59E0B" // Amber/Orange
  return "#EF4444" // Red - Score 0
}

function getScoreMessage(score: number): string {
  if (score === -1) return "Non renseigné. Ajoutez des chauffeurs/véhicules."
  if (score >= 100) return "Votre flotte est en parfaite conformité."
  if (score >= 70) return "Attention : Renouvellement proche."
  if (score > 0) return "Urgent : Document(s) expiré(s) !"
  return "Critique : Score NoX à 0 !"
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
  onNavigateToEntity?: (entityType: "driver" | "vehicle", entityId: string, field: string) => void
}

export function GuardianScore({ onNavigateToEntity }: GuardianScoreProps) {
  const [showDetails, setShowDetails] = useState(false)
  const { drivers, vehicles, plan } = useNox()
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.SOLO

  // Get visible drivers/vehicles based on plan limits
  const visibleDrivers = drivers.slice(0, limits.drivers)
  const visibleVehicles = vehicles.slice(0, limits.vehicles)

  // Calculate compliance score and issues
  const { score, issues } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const issuesList: DocumentIssue[] = []
    let hasExpired = false
    let hasWarning = false
    let hasCritical = false

    // Helper to check date
    function checkDate(dateStr: string, label: string, docType: string, entityType: "driver" | "vehicle", entityId: string, field: string) {
      const expDate = new Date(dateStr)
      const diffTime = expDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        hasExpired = true
        issuesList.push({
          type: "expired",
          label,
          daysRemaining: diffDays,
          documentType: docType,
          entityType,
          entityId,
          field,
        })
      } else if (diffDays <= 30) {
        hasWarning = true
        issuesList.push({
          type: "warning",
          label,
          daysRemaining: diffDays,
          documentType: docType,
          entityType,
          entityId,
          field,
        })
      }
    }

    // Check driver documents
    visibleDrivers.forEach((driver: any) => {
      // Carte Pro
      checkDate(driver.carteProExpiration, `Carte Pro - ${driver.name}`, "Carte Pro VTC", "driver", driver.id, "carteProExpiration")
      
      // APAC
      if (driver.apacExpiration) {
        checkDate(driver.apacExpiration, `APAC - ${driver.name}`, "Attestation Préfectorale", "driver", driver.id, "apacExpiration")
      }
      
      // RC Pro
      if (driver.rcProExpiration) {
        checkDate(driver.rcProExpiration, `RC Pro - ${driver.name}`, "RC Professionnelle", "driver", driver.id, "rcProExpiration")
      }
    })

    // Check vehicle documents and age
    visibleVehicles.forEach((vehicle: any) => {
      // Assurance Transport à Titre Onéreux
      checkDate(vehicle.assuranceTransportExpiration, `Assurance - ${vehicle.plate}`, "Assurance Transport à Titre Onéreux", "vehicle", vehicle.id, "assuranceTransportExpiration")
      
      // Contrôle Technique
      checkDate(vehicle.controleTechniqueExpiration, `CT - ${vehicle.plate}`, "Contrôle Technique", "vehicle", vehicle.id, "controleTechniqueExpiration")
      
      // Age check for thermal vehicles (5/6/7 algorithm)
      const vehicleAge = calculateVehicleAge(vehicle.datePremiereImmat)
      const ageStatus = getVehicleAgeStatus(vehicleAge, vehicle.motorType)
      
      if (ageStatus.status === "critical") {
        hasCritical = true
        issuesList.push({
          type: "critical",
          label: `${vehicle.model} - ${vehicle.plate}`,
          daysRemaining: 0,
          documentType: `Véhicule thermique >= 7 ans (${vehicleAge} ans)`,
          entityType: "vehicle",
          entityId: vehicle.id,
          field: "datePremiereImmat",
        })
      } else if (ageStatus.status === "alert") {
        hasExpired = true
        issuesList.push({
          type: "expired",
          label: `${vehicle.model} - ${vehicle.plate}`,
          daysRemaining: 0,
          documentType: `Véhicule thermique 6-7 ans (${vehicleAge} ans)`,
          entityType: "vehicle",
          entityId: vehicle.id,
          field: "datePremiereImmat",
        })
      } else if (ageStatus.status === "warning") {
        hasWarning = true
        issuesList.push({
          type: "warning",
          label: `${vehicle.model} - ${vehicle.plate}`,
          daysRemaining: 0,
          documentType: `Véhicule thermique 5-6 ans (${vehicleAge} ans)`,
          entityType: "vehicle",
          entityId: vehicle.id,
          field: "datePremiereImmat",
        })
      }
    })

    // Calculate score
    // Score = 0 si:
    // - APAC expiré
    // - RC Pro expiré
    // - Assurance Transport expiré
    // - Véhicule thermique >= 7 ans
    let calculatedScore = 100
    
    if (visibleDrivers.length === 0 && visibleVehicles.length === 0) {
      calculatedScore = -1
    } else if (hasCritical) {
      calculatedScore = 0
    } else if (hasExpired) {
      calculatedScore = 40
    } else if (hasWarning) {
      calculatedScore = 80
    }

    // Check specifically for expired APAC, RC Pro, Assurance - these set score to 0
    const criticalExpired = issuesList.some(issue => 
      issue.type === "expired" && 
      (issue.documentType === "Attestation Préfectorale" || 
       issue.documentType === "RC Professionnelle" || 
       issue.documentType === "Assurance Transport à Titre Onéreux")
    )
    
    if (criticalExpired && calculatedScore !== -1) {
      calculatedScore = 0
    }

    // Sort issues: critical first, then expired, then by days remaining
    issuesList.sort((a, b) => {
      const priority = { critical: 0, expired: 1, warning: 2 }
      if (priority[a.type] !== priority[b.type]) {
        return priority[a.type] - priority[b.type]
      }
      return a.daysRemaining - b.daysRemaining
    })

    return { score: calculatedScore, issues: issuesList }
  }, [visibleDrivers, visibleVehicles])

  const scoreColor = getScoreColor(score)
  const scoreMessage = getScoreMessage(score)

  // SVG circle parameters
  const size = 180
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progressScore = score === -1 ? 0 : score
  const strokeDashoffset = circumference - (progressScore / 100) * circumference

  function handleIssueClick(issue: DocumentIssue) {
    if (onNavigateToEntity) {
      setShowDetails(false)
      onNavigateToEntity(issue.entityType, issue.entityId, issue.field)
    }
  }

  return (
    <section className="px-4 w-full">
      <div className="relative flex flex-col items-center justify-center py-6 mx-auto max-w-md">
        {/* Circular Progress Ring */}
        <button
          onClick={() => setShowDetails(true)}
          className="relative group cursor-pointer active:scale-[0.98] transition-transform"
          aria-label="Voir les détails de conformité"
        >
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#1A1A1A"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={scoreColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{
                filter: `drop-shadow(0 0 8px ${scoreColor}40)`,
              }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-4xl font-bold font-heading"
              style={{ color: scoreColor }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {score === -1 ? "—" : `${score}%`}
            </motion.span>
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase mt-1">
              SCORE NOX
            </span>
          </div>

          {/* Hover effect */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent group-hover:border-gold/20 transition-colors" />
        </button>

        {/* Status message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-4 flex items-center gap-2"
        >
          {score === -1 ? (
            <AlertTriangle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          ) : score >= 100 ? (
            <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
          ) : score >= 70 ? (
            <Clock className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.5} />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" strokeWidth={1.5} />
          )}
          <p className={cn(
            "text-xs font-medium",
            score === -1 ? "text-muted-foreground" : score >= 100 ? "text-emerald-500" : score >= 70 ? "text-[#D4AF37]" : "text-red-500"
          )}>
            {scoreMessage}
          </p>
        </motion.div>

        {/* Issues indicator */}
        {issues.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-[10px] text-muted-foreground mt-2"
          >
            Appuyez pour voir les détails
          </motion.p>
        )}
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
                    score >= 100 ? "bg-emerald-500/15" : score >= 70 ? "bg-[#D4AF37]/15" : "bg-red-500/15"
                  )}>
                    <ShieldCheck
                      className={cn(
                        "h-5 w-5",
                        score >= 100 ? "text-emerald-500" : score >= 70 ? "text-[#D4AF37]" : "text-red-500"
                      )}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#F5F5F5]">
                      Guardian NoX
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {score === -1 
                        ? "Veuillez ajouter votre flotte"
                        : issues.length === 0
                          ? "Tous vos documents sont à jour"
                          : `${issues.length} document${issues.length > 1 ? "s" : ""} à surveiller`}
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

              <div className="px-5 pb-8 max-h-[50vh] overflow-y-auto space-y-3">
                {score === -1 ? (
                  <div className="flex flex-col items-center py-8">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-3" strokeWidth={1} />
                    <p className="text-sm text-[#F5F5F5] font-medium">Aucune donnée</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Ajoutez au moins un véhicule et un chauffeur pour calculer votre score de conformité.
                    </p>
                  </div>
                ) : issues.length === 0 ? (
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
                        {issue.entityType === "driver" ? (
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
