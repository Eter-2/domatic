import { cn } from '@/lib/utils'

interface OnlineIndicatorProps {
  isOnline: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
}

export function OnlineIndicator({ isOnline, size = 'md', showLabel, className }: OnlineIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="relative flex">
        {isOnline && (
          <span
            className={cn(
              'absolute inline-flex rounded-full bg-emerald-400 opacity-75',
              'animate-ping',
              sizeClasses[size]
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full',
            sizeClasses[size],
            isOnline ? 'bg-emerald-400' : 'bg-slate-600'
          )}
        />
      </span>
      {showLabel && (
        <span className={cn('text-xs font-medium', isOnline ? 'text-emerald-400' : 'text-slate-500')}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </span>
  )
}
