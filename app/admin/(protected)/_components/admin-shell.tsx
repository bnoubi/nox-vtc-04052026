'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Coins,
  BarChart3,
  Settings,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  ShieldCheck,
} from 'lucide-react'
import { useAdminTheme } from '@/lib/theme/admin-theme-context'
import { createClient } from '@/lib/supabase/client'
import { Toaster } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const DEFAULT_WIDTH = 260
const MIN_WIDTH = 60
const MAX_WIDTH = 320
const STORAGE_WIDTH = 'admin_sidebar_width'
const STORAGE_COLLAPSED = 'admin_sidebar_collapsed'

const navItems = [
  { href: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/subscriptions', label: 'Abonnements', icon: CreditCard },
  { href: '/admin/tokens', label: 'Jetons', icon: Coins },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Configuration', icon: Settings },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  { href: '/admin/team', label: 'Équipe', icon: ShieldCheck },
]

const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Tableau de bord',
  '/admin/users': 'Utilisateurs',
  '/admin/subscriptions': 'Abonnements',
  '/admin/tokens': 'Jetons',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'Configuration',
  '/admin/support': 'Support',
  '/admin/team': 'Équipe Admin',
}

interface AdminShellProps {
  children: React.ReactNode
  userEmail: string
  userInitials: string
  openTicketCount: number
}

export function AdminShell({ children, userEmail, userInitials, openTicketCount }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useAdminTheme()

  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const widthRef = useRef(DEFAULT_WIDTH)
  const collapsedRef = useRef(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => { widthRef.current = width }, [width])
  useEffect(() => { collapsedRef.current = collapsed }, [collapsed])

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(STORAGE_WIDTH) ?? '', 10)
    if (!isNaN(saved) && saved > MIN_WIDTH) setWidth(Math.min(MAX_WIDTH, saved))
    setCollapsed(localStorage.getItem(STORAGE_COLLAPSED) === 'true')
  }, [])

  useEffect(() => {
    document.body.style.userSelect = isDragging ? 'none' : ''
    document.body.style.cursor = isDragging ? 'col-resize' : ''
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startWidth: collapsedRef.current ? MIN_WIDTH : widthRef.current,
    }
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + e.clientX - dragRef.current.startX))
      if (next > MIN_WIDTH) {
        setWidth(next)
        setCollapsed(false)
      } else {
        setCollapsed(true)
      }
    }

    function onMouseUp() {
      setIsDragging(false)
      localStorage.setItem(STORAGE_WIDTH, String(widthRef.current))
      localStorage.setItem(STORAGE_COLLAPSED, String(collapsedRef.current))
      dragRef.current = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging])

  function toggleCollapse() {
    const next = !collapsedRef.current
    setCollapsed(next)
    localStorage.setItem(STORAGE_COLLAPSED, String(next))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const pageTitle = pageTitles[pathname] ?? 'Back-Office'
  const displayWidth = collapsed ? MIN_WIDTH : width

  return (
    <div
      data-admin-theme={theme}
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--admin-background)', color: 'var(--admin-foreground)' }}
    >
      {/* Sidebar */}
      <aside
        className="relative flex flex-col shrink-0 h-full border-r overflow-hidden"
        style={{
          width: displayWidth,
          backgroundColor: 'var(--admin-sidebar)',
          borderColor: 'var(--admin-border)',
          transition: isDragging ? 'none' : 'width 300ms ease-in-out',
        }}
      >
        {/* Logo */}
        <div
          className="h-16 flex items-center shrink-0 border-b"
          style={{
            borderColor: 'var(--admin-border)',
            justifyContent: collapsed ? 'center' : undefined,
            padding: collapsed ? '0' : '0 24px',
          }}
        >
          {collapsed ? (
            <span className="font-bold text-lg" style={{ color: 'var(--admin-primary)' }}>N</span>
          ) : (
            <>
              <span className="font-bold text-xl" style={{ color: 'var(--admin-primary)' }}>
                NoX VTC
              </span>
              <span
                className="ml-2 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap"
                style={{ backgroundColor: 'var(--admin-active-bg)', color: 'var(--admin-primary)' }}
              >
                Admin
              </span>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto space-y-1"
          style={{ padding: `16px ${collapsed ? '6px' : '12px'}` }}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            const badge = href === '/admin/support' && openTicketCount > 0 ? openTicketCount : null
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className="flex items-center rounded-lg text-sm font-medium transition-colors"
                style={{
                  height: 40,
                  justifyContent: collapsed ? 'center' : undefined,
                  gap: collapsed ? 0 : 12,
                  ...(isActive
                    ? {
                        backgroundColor: 'var(--admin-active-bg)',
                        color: 'var(--admin-primary)',
                        borderLeft: collapsed ? undefined : '3px solid var(--admin-primary)',
                        padding: collapsed ? undefined : '0 12px 0 9px',
                      }
                    : {
                        color: 'var(--admin-muted-foreground)',
                        padding: collapsed ? undefined : '0 12px',
                      }),
                }}
              >
                <span className="relative shrink-0">
                  <Icon size={18} />
                  {badge !== null && collapsed && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: '#ef4444' }}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                    {badge !== null && (
                      <span
                        className="ml-auto shrink-0 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
                        style={{ backgroundColor: '#ef4444' }}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Pied sidebar */}
        <div
          className="shrink-0 border-t"
          style={{
            borderColor: 'var(--admin-border)',
            padding: collapsed ? '12px 0' : '16px',
          }}
        >
          {collapsed ? (
            <div className="flex justify-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
                title={userEmail}
              >
                {userInitials}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              >
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-foreground)' }}>
                  {userEmail}
                </p>
                <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Administrateur
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 bottom-0 w-1 z-10 cursor-col-resize select-none"
          onMouseDown={handleResizeStart}
          style={{ backgroundColor: isDragging ? 'var(--admin-primary)' : 'transparent' }}
        />

        {/* Toggle collapse */}
        <button
          onClick={toggleCollapse}
          className="absolute top-1/2 -translate-y-1/2 z-20 w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            right: 2,
            backgroundColor: 'var(--admin-card)',
            border: '1px solid var(--admin-border)',
            color: 'var(--admin-muted-foreground)',
          }}
          title={collapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
        >
          {collapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>
      </aside>

      <Toaster richColors position="top-right" />

      {/* Zone principale */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="h-16 flex items-center justify-between px-6 border-b shrink-0"
          style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
        >
          <h1 className="text-lg font-semibold" style={{ color: 'var(--admin-foreground)' }}>
            {pageTitle}
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleTheme()}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{
                color: 'var(--admin-muted-foreground)',
                border: '1px solid var(--admin-border)',
              }}
              title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
                >
                  {userInitials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs text-muted-foreground">Connecté en tant que</p>
                  <p className="text-sm font-medium truncate">{userEmail}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive cursor-pointer"
                >
                  <LogOut size={15} className="mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Contenu */}
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: 'var(--admin-background)' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
