import { AlertTriangle, AlertOctagon, Info, ShieldAlert, Shield } from 'lucide-react'
import { cn, getSeverityColor } from '@/lib/utils'
import type { SecuritySeverity } from '@/types'

const SEVERITY_ICONS: Record<SecuritySeverity, typeof Shield> = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: ShieldAlert,
  low: Shield,
  info: Info,
}

interface SeverityBadgeProps {
  severity: SecuritySeverity
  showIcon?: boolean
  className?: string
}

export function SeverityBadge({ severity, showIcon = true, className }: SeverityBadgeProps) {
  const Icon = SEVERITY_ICONS[severity] ?? Info

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        getSeverityColor(severity),
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {severity}
    </span>
  )
}
