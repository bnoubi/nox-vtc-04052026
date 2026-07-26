"use client"

import { Suspense, useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { BottomNav, type TabId } from "@/components/dashboard/bottom-nav"
import { SecurityBadge } from "@/components/dashboard/security-badge"
import { DashboardTab } from "@/components/dashboard/tab-dashboard"
import { CalendarTab } from "@/components/dashboard/tab-calendar"
import { DocumentsTab } from "@/components/dashboard/tab-documents"
import { ClientsTab } from "@/components/dashboard/tab-clients"
import { SettingsTab } from "@/components/dashboard/tab-settings"
import { NavProvider } from "@/components/dashboard/nav-context"
import { WelcomeComponent } from "@/components/WelcomeComponent"
import { OnboardingComponent } from "@/components/OnboardingComponent"
import { Toaster } from "sonner"
import { createClient } from "@/lib/supabase/client"

import { NoxProvider, useNox } from "@/components/dashboard/nox-context"
import { AlertTriangle } from "lucide-react"
import { checkIsAdmin } from "@/app/admin/actions"
import { ADMIN_URL } from "@/lib/admin-url"

const tabComponents: Record<TabId, React.ComponentType> = {
  dashboard: DashboardTab,
  calendar: CalendarTab,
  documents: DocumentsTab,
  clients: ClientsTab,
  settings: SettingsTab,
}

type AppStep = "welcome" | "onboarding" | "dashboard"

const WELCOME_SESSION_KEY = "nox_welcome_shown"

function DeletionBanner() {
  const { accountStatus, deletionScheduledFor } = useNox()
  if (accountStatus !== 'pending_deletion') return null
  const dateStr = deletionScheduledFor
    ? new Date(deletionScheduledFor).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  return (
    <div className="bg-red-950 border-b border-red-600 px-4 py-3 text-white">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-red-200 text-sm">Suppression de compte programmée</p>
          {dateStr && (
            <p className="text-red-300/80">Votre compte sera définitivement supprimé le {dateStr}.</p>
          )}
          <p className="text-red-300/80">
            Pour annuler, contactez-nous immédiatement :{" "}
            <a href="mailto:support@noxvtc.fr" className="text-[#C9A84C] underline">support@noxvtc.fr</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <AppPage />
    </Suspense>
  )
}

function AppPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard")
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<AppStep>("dashboard")
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeStep = parseInt(searchParams.get("resume_step") || "0", 10)

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }

      const isAdmin = await checkIsAdmin()
      if (isAdmin) {
        window.location.href = `${ADMIN_URL}/admin/dashboard`
        return
      }

      // profiles = source de vérité ; user_accounts = fallback
      const [profResult, accResult] = await Promise.all([
        supabase.from("profiles").select("onboarding_status").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_accounts").select("onboarding_status").eq("id", user.id).maybeSingle(),
      ])

      const status =
        profResult.data?.onboarding_status ??
        accResult.data?.onboarding_status ??
        "not_started"
      setOnboardingStatus(status)

      if (status === "completed") {
        void fetch("/api/onboarding/welcome", { method: "POST" }).catch(() => {})
        setStep("dashboard")
      } else if (resumeStep > 0) {
        // Reprise d'onboarding : skip directement vers l'étape sauvegardée
        setStep("onboarding")
      } else {
        const welcomeShown = sessionStorage.getItem(WELCOME_SESSION_KEY)
        if (!welcomeShown) {
          setStep("welcome")
        } else {
          setStep("onboarding")
        }
      }
      
      setMounted(true)
    }
    checkSession()
  }, [])

  function handleWelcomeFinished() {
    sessionStorage.setItem(WELCOME_SESSION_KEY, "true")
    if (onboardingStatus === "completed") {
      setStep("dashboard")
    } else {
      setStep("onboarding")
    }
  }

  function handleOnboardingComplete() {
    setOnboardingStatus("completed")
    setStep("dashboard")
  }

  const ActiveComponent = tabComponents[activeTab]

  if (!mounted) {
    return (
      <main className="min-h-screen bg-background">
        <div className="fixed inset-0 bg-gradient-to-b from-gold/[0.02] to-transparent pointer-events-none" />
      </main>
    )
  }

  // Step 1: Welcome (Splash Screen)
  if (step === "welcome") {
    return <WelcomeComponent onFinished={handleWelcomeFinished} />
  }

  // Step 2: Onboarding (Initialization)
  if (step === "onboarding") {
    return <OnboardingComponent onComplete={handleOnboardingComplete} resumeStep={resumeStep} />
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // Step 3: Dashboard
  return (
    <NoxProvider>
        <NavProvider onTabChange={setActiveTab} onLogout={handleLogout}>
          <main className="min-h-screen bg-background overflow-x-hidden">
            <div className="fixed inset-0 bg-gradient-to-b from-gold/[0.02] to-transparent pointer-events-none" />

            <div className="relative max-w-md mx-auto h-screen flex flex-col pb-32 overflow-x-hidden">
              <DeletionBanner />
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="flex-1 overflow-y-auto"
                >
                  <ActiveComponent />
                </motion.div>
              </AnimatePresence>
            </div>

            <SecurityBadge />
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
            <Toaster
              position="top-center"
              toastOptions={{
                unstyled: true,
                classNames: {
                  toast: "w-full max-w-md mx-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#141414]/95 backdrop-blur-xl border border-[#D4AF37]/30 shadow-2xl shadow-black/50",
                  title: "text-sm font-semibold text-[#F5F5F5]",
                  description: "text-[11px] text-[#A1A1AA]",
                },
              }}
            />
          </main>
        </NavProvider>
    </NoxProvider>
  )
}
