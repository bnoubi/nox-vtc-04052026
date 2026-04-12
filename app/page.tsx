"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
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

import { NoxProvider } from "@/components/dashboard/nox-context"

const tabComponents: Record<TabId, React.ComponentType> = {
  dashboard: DashboardTab,
  calendar: CalendarTab,
  documents: DocumentsTab,
  clients: ClientsTab,
  settings: SettingsTab,
}

type AppStep = "welcome" | "onboarding" | "dashboard"

const WELCOME_SESSION_KEY = "nox_welcome_shown"

export default function AppPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard")
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<AppStep>("dashboard")
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }

      // Read profiles data
      const { data: profile } = await supabase
        .from("user_accounts")
        .select("onboarding_status")
        .eq("id", user.id)
        .single()
        
      const status = profile?.onboarding_status || "not_started"
      setOnboardingStatus(status)

      if (status === "completed") {
        setStep("dashboard")
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
    return <OnboardingComponent onComplete={handleOnboardingComplete} />
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
