import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  trend?: { value: number; label: string }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  badge?: string | number
}

const variantStyles = {
  default: 'border-border',
  success: 'border-emerald-500/30 bg-emerald-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  danger: 'border-red-500/30 bg-red-500/5',
  info: 'border-blue-500/30 bg-blue-500/5',
}

const iconVariantStyles = {
  default: 'text-slate-400 bg-slate-400/10',
  success: 'text-emerald-400 bg-emerald-400/10',
  warning: 'text-amber-400 bg-amber-400/10',
  danger: 'text-red-400 bg-red-400/10',
  info: 'text-blue-400 bg-blue-400/10',
}

export function StatCard({ label, value, icon, trend, variant = 'default', className, badge }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border bg-card p-5 shadow-card transition-all duration-200 hover:bg-card-hover',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground-muted">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{value}</span>
            {badge !== undefined && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                {badge}
              </span>
            )}
          </div>
          {trend && (
            <p className={cn('mt-1 text-xs', trend.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconVariantStyles[variant])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
