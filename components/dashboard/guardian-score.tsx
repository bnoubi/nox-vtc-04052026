"use client"

import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { allDrivers, allVehicles } from "./data"
import { usePlan, PLAN_LIMITS } from "./plan-context"

interface DocumentIssue {
  type: "expired" | "warning"
  label: string
  daysRemaining: number
  documentType: string
}

function getScoreColor(score: number): string {
  if (score >= 100) return "#10B981" // Emerald green
  if (score >= 70) return "#D4AF37" // Gold/Amber
  return "#EF4444" // Red
}

function getScoreMessage(score: number): string {
  if (score >= 100) return "Votre flotte est en parfaite conformité."
  if (score >= 70) return "Attention : Renouvellement proche."
  return "Urgent : Document(s) expiré(s) !"
}

export function GuardianScore() {
  const [showDetails, setShowDetails] = useState(false)
  const { plan } = usePlan()
  const limits = PLAN_LIMITS[plan]

  // Get visible drivers/vehicles based on plan limits
  const visibleDrivers = allDrivers.slice(0, limits.drivers)
  const visibleVehicles = allVehicles.slice(0, limits.vehicles)

  // Calculate compliance score and issues
  const { score, issues } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const issuesList: DocumentIssue[] = []
    let expiredCount = 0
    let warningCount = 0
    let totalDocuments = 0

    // Check driver carte pro expirations
    visibleDrivers.forEach((driver) => {
      totalDocuments++
      const expDate = new Date(driver.carteProExpiration)
      const diffTime = expDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        expiredCount++
        issuesList.push({
          type: "expired",
          label: `Carte Pro ${driver.name}`,
          daysRemaining: diffDays,
          documentType: "Carte Pro VTC",
        })
      } else if (diffDays <= 30) {
        warningCount++
        issuesList.push({
          type: "warning",
          label: `Carte Pro ${driver.name}`,
          daysRemaining: diffDays,
          documentType: "Carte Pro VTC",
        })
      }
    })

    // Check vehicle assurance expirations
    visibleVehicles.forEach((vehicle) => {
      totalDocuments++
      const expDate = new Date(vehicle.assuranceExpiration)
      const diffTime = expDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        expiredCount++
        issuesList.push({
          type: "expired",
          label: `Assurance ${vehicle.plate}`,
          daysRemaining: diffDays,
          documentType: "Assurance",
        })
      } else if (diffDays <= 30) {
        warningCount++
        issuesList.push({
          type: "warning",
          label: `Assurance ${vehicle.plate}`,
          daysRemaining: diffDays,
          documentType: "Assurance",
        })
      }
    })

    // Check vehicle controle technique expirations
    visibleVehicles.forEach((vehicle) => {
      totalDocuments++
      const expDate = new Date(vehicle.controleTechniqueExpiration)
      const diffTime = expDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        expiredCount++
        issuesList.push({
          type: "expired",
          label: `CT ${vehicle.plate}`,
          daysRemaining: diffDays,
          documentType: "Contrôle Technique",
        })
      } else if (diffDays <= 30) {
        warningCount++
        issuesList.push({
          type: "warning",
          label: `CT ${vehicle.plate}`,
          daysRemaining: diffDays,
          documentType: "Contrôle Technique",
        })
      }
    })

    // Calculate score
    let calculatedScore = 100
    if (expiredCount > 0) {
      calculatedScore = 40
    } else if (warningCount > 0) {
      calculatedScore = 80
    }

    // Sort issues: expired first, then by days remaining
    issuesList.sort((a, b) => {
      if (a.type === "expired" && b.type !== "expired") return -1
      if (a.type !== "expired" && b.type === "expired") return 1
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
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <section className="px-4">
      <div className="relative flex flex-col items-center py-6">
        {/* Circular Progress Ring */}
        <button
          onClick={() => setShowDetails(true)}
          className="relative group cursor-pointer"
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
              {score}%
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
          {score >= 100 ? (
            <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
          ) : score >= 70 ? (
            <Clock className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.5} />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500" strokeWidth={1.5} />
          )}
          <p className={cn(
            "text-xs font-medium",
            score >= 100 ? "text-emerald-500" : score >= 70 ? "text-[#D4AF37]" : "text-red-500"
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
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
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
                      {issues.length === 0
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

              {/* Issues List */}
              <div className="px-5 pb-8 max-h-[50vh] overflow-y-auto space-y-3">
                {issues.length === 0 ? (
                  <div className="flex flex-col items-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" strokeWidth={1} />
                    <p className="text-sm text-[#F5F5F5] font-medium">Parfaite conformité</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aucun document n'expire dans les 30 prochains jours.
                    </p>
                  </div>
                ) : (
                  issues.map((issue, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border",
                        issue.type === "expired"
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-[#D4AF37]/10 border-[#D4AF37]/30"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                        issue.type === "expired" ? "bg-red-500/20" : "bg-[#D4AF37]/20"
                      )}>
                        {issue.type === "expired" ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" strokeWidth={1.5} />
                        ) : (
                          <Clock className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          issue.type === "expired" ? "text-red-400" : "text-[#F5F5F5]"
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
                          issue.type === "expired" ? "text-red-500" : "text-[#D4AF37]"
                        )}>
                          {issue.type === "expired"
                            ? `Expiré`
                            : `${issue.daysRemaining}j`}
                        </p>
                        {issue.type === "expired" && (
                          <p className="text-[10px] text-red-400/70">
                            depuis {Math.abs(issue.daysRemaining)}j
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
