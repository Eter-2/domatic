'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Cpu,
  Home,
  ShieldAlert,
  Zap,
  Terminal,
  HardDrive,
  Network,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useAppStore } from '@/lib/store'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/devices', icon: Cpu, label: 'Devices' },
  { href: '/rooms', icon: Home, label: 'Rooms' },
  { href: '/security', icon: ShieldAlert, label: 'Security' },
  { href: '/automations', icon: Zap, label: 'Automations' },
  { href: '/mqtt', icon: Terminal, label: 'MQTT Console' },
  { href: '/firmware', icon: HardDrive, label: 'Firmware' },
  { href: '/network-map', icon: Network, label: 'Network Map' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { unreadAlerts } = useAppStore()

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen border-r border-border bg-card transition-all duration-300 relative flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 border-b border-border px-4 py-4', collapsed && 'justify-center px-2')}>
        <div className="flex-shrink-0">
          <Image src="/logo.svg" alt="Dom'Atic" width={32} height={32} priority />
        </div>
        {!collapsed && (
          <div>
            <span className="text-base font-bold text-foreground">Dom&apos;Atic</span>
            <p className="text-[10px] text-foreground-dim leading-none mt-0.5">Home Automation Hub</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            const showBadge = href === '/security' && unreadAlerts > 0

            return (
              <li key={href}>
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-foreground-muted hover:bg-surface hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {showBadge && (
                    <span
                      className={cn(
                        'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white',
                        collapsed && 'absolute -right-1 -top-1 ml-0'
                      )}
                    >
                      {unreadAlerts > 99 ? '99+' : unreadAlerts}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center border-t border-border py-3 text-foreground-dim hover:text-foreground hover:bg-surface transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : (
          <div className="flex w-full items-center gap-2 px-4">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs">Collapse</span>
          </div>
        )}
      </button>
    </aside>
  )
}

// Mobile bottom navigation
export function MobileNav() {
  const pathname = usePathname()
  const { unreadAlerts } = useAppStore()

  const mobileItems = NAV_ITEMS.slice(0, 5) // Show top 5 on mobile

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t border-border bg-card">
      {mobileItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        const showBadge = href === '/security' && unreadAlerts > 0

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
              isActive ? 'text-accent' : 'text-foreground-dim hover:text-foreground'
            )}
            aria-label={label}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label.split(' ')[0]}</span>
            {showBadge && (
              <span className="absolute right-2 top-1 h-4 min-w-4 rounded-full bg-red-500 px-0.5 text-center text-[9px] font-bold text-white leading-4">
                {unreadAlerts}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
