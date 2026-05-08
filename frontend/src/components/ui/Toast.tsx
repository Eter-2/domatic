'use client'

import { useEffect } from 'react'
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { useAppStore, type Toast } from '@/lib/store'
import { cn } from '@/lib/utils'

const ICONS = {
  default: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const STYLES = {
  default: 'border-border bg-card text-foreground',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
}

function ToastItem({ toast }: { toast: Toast }) {
  const { dismissToast } = useAppStore()
  const Icon = ICONS[toast.variant]

  useEffect(() => {
    const timer = setTimeout(() => {
      dismissToast(toast.id)
    }, toast.duration || 5000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, dismissToast])

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 shadow-xl animate-slide-in-right max-w-sm w-full',
        STYLES[toast.variant]
      )}
      role="alert"
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs opacity-80">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => dismissToast(toast.id)}
        className="flex-shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useAppStore()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
