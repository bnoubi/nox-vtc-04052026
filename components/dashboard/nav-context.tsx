"use client"

import { createContext, useContext, useCallback, useRef } from "react"
import type { TabId } from "./bottom-nav"

type SettingsScreen = "main" | "team" | "fleet" | "profile" | "enterprise" | "banking" | "subscription" | "notifications" | "security"

interface NavContextValue {
  switchTab: (tab: TabId) => void
  navigateToSubscription: () => void
  registerSettingsNavigator: (fn: (screen: SettingsScreen) => void) => void
  openWallet: () => void
  registerWalletOpener: (fn: () => void) => void
  logout: () => void
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({
  children,
  onTabChange,
  onLogout,
}: {
  children: React.ReactNode
  onTabChange: (tab: TabId) => void
  onLogout?: () => void
}) {
  const settingsNavigatorRef = useRef<((screen: SettingsScreen) => void) | null>(null)
  const walletOpenerRef = useRef<(() => void) | null>(null)

  const registerSettingsNavigator = useCallback((fn: (screen: SettingsScreen) => void) => {
    settingsNavigatorRef.current = fn
  }, [])

  const registerWalletOpener = useCallback((fn: () => void) => {
    walletOpenerRef.current = fn
  }, [])

  const openWallet = useCallback(() => {
    walletOpenerRef.current?.()
  }, [])

  const logout = useCallback(() => {
    onLogout?.()
  }, [onLogout])

  const switchTab = useCallback((tab: TabId) => {
    onTabChange(tab)
  }, [onTabChange])

  const navigateToSubscription = useCallback(() => {
    onTabChange("settings")
    // Small delay so the settings tab mounts before we navigate internally
    setTimeout(() => {
      settingsNavigatorRef.current?.("subscription")
    }, 50)
  }, [onTabChange])

  return (
    <NavContext.Provider value={{ switchTab, navigateToSubscription, registerSettingsNavigator, openWallet, registerWalletOpener, logout }}>
      {children}
    </NavContext.Provider>
  )
}

export function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error("useNav must be used within NavProvider")
  return ctx
}
