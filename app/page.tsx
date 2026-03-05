"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BottomNav, type TabId } from "@/components/dashboard/bottom-nav"
import { SecurityBadge } from "@/components/dashboard/security-badge"
import { DashboardTab } from "@/components/dashboard/tab-dashboard"
import { CalendarTab } from "@/components/dashboard/tab-calendar"
import { DocumentsTab } from "@/components/dashboard/tab-documents"
import { ClientsTab } from "@/components/dashboard/tab-clients"
import { SettingsTab } from "@/components/dashboard/tab-settings"
import { PlanProvider } from "@/components/dashboard/plan-context"
import { NavProvider } from "@/components/dashboard/nav-context"
import { Toaster } from "sonner"

const tabComponents: Record<TabId, React.ComponentType> = {
  dashboard: DashboardTab,
  calendar: CalendarTab,
  documents: DocumentsTab,
  clients: ClientsTab,
  settings: SettingsTab,
}

export default function AppPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const ActiveComponent = tabComponents[activeTab]

  if (!mounted) {
    return (
      <main className="min-h-screen bg-background">
        <div className="fixed inset-0 bg-gradient-to-b from-gold/[0.02] to-transparent pointer-events-none" />
      </main>
    )
  }

  return (
    <PlanProvider>
      <NavProvider onTabChange={setActiveTab}>
        <main className="min-h-screen bg-background">
          <div className="fixed inset-0 bg-gradient-to-b from-gold/[0.02] to-transparent pointer-events-none" />

          <div className="relative max-w-md mx-auto h-screen flex flex-col pb-32">
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
    </PlanProvider>
  )
}
