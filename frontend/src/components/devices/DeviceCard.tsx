import { Cpu, MapPin, Clock } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { ProtocolBadge } from './ProtocolBadge'
import { FirmwareBadge } from './FirmwareBadge'
import { OnlineIndicator } from './OnlineIndicator'
import type { Device } from '@/types'

interface DeviceCardProps {
  device: Device
  onClick?: () => void
  selected?: boolean
}

export function DeviceCard({ device, onClick, selected }: DeviceCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'group rounded-xl border bg-card p-4 shadow-card transition-all duration-200',
        onClick && 'cursor-pointer hover:bg-card-hover hover:border-accent/30',
        selected && 'border-accent bg-accent/5'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            device.is_online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'
          )}>
            <Cpu className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{device.name}</h3>
            {device.room && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-foreground-muted">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{device.room.name}</span>
              </div>
            )}
          </div>
        </div>
        <OnlineIndicator isOnline={device.is_online} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <ProtocolBadge protocol={device.protocol} size="sm" />
        <FirmwareBadge firmware={device.firmware_type} size="sm" />
      </div>

      {device.last_seen && (
        <div className="mt-3 flex items-center gap-1 text-xs text-foreground-dim">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(device.last_seen)}</span>
        </div>
      )}

      {device.ip_address && (
        <div className="mt-1 font-mono text-xs text-foreground-dim">{device.ip_address}</div>
      )}
    </div>
  )
}
