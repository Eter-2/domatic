'use client'

import { Bell, LogOut, User, Wifi, WifiOff, Loader } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const { wsConnected, wsReconnecting, unreadAlerts, clearAlerts } = useAppStore()
  const { user, logout } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      {title && (
        <h1 className="text-sm font-semibold text-foreground md:text-base">{title}</h1>
      )}

      <div className="flex items-center gap-3 ml-auto">
        {/* WS connection status */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            wsConnected
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : wsReconnecting
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          )}
          title={wsConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
        >
          {wsConnected ? (
            <Wifi className="h-3 w-3" />
          ) : wsReconnecting ? (
            <Loader className="h-3 w-3 animate-spin" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">
            {wsConnected ? 'Live' : wsReconnecting ? 'Reconnecting…' : 'Disconnected'}
          </span>
        </div>

        {/* Notification bell */}
        <button
          onClick={clearAlerts}
          className="relative rounded-lg p-1.5 text-foreground-muted hover:bg-surface hover:text-foreground transition-colors"
          aria-label={`${unreadAlerts} security alerts`}
        >
          <Bell className="h-4 w-4" />
          {unreadAlerts > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {unreadAlerts > 9 ? '9+' : unreadAlerts}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground-muted hover:bg-surface hover:text-foreground transition-colors"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="hidden sm:block text-xs font-medium max-w-[120px] truncate">
              {user?.name ?? user?.email ?? 'User'}
            </span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-card shadow-xl animate-fade-in">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-foreground-muted truncate">{user?.email}</p>
                <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent capitalize">
                  {user?.role}
                </span>
              </div>
              <div className="p-1">
                <button
                  onClick={() => { setUserMenuOpen(false); logout() }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-muted hover:bg-surface hover:text-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
