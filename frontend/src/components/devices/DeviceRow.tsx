import { Clock, MapPin, ChevronRight } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { ProtocolBadge } from './ProtocolBadge'
import { FirmwareBadge } from './FirmwareBadge'
import { OnlineIndicator } from './OnlineIndicator'
import type { Device } from '@/types'

interface DeviceRowProps {
  device: Device
  onClick?: () => void
  selected?: boolean
}

export function DeviceRow({ device, onClick, selected }: DeviceRowProps) {
  return (
    <tr
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'border-b border-border transition-colors',
        onClick && 'cursor-pointer hover:bg-surface',
        selected && 'bg-accent/5'
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <OnlineIndicator isOnline={device.is_online} size="sm" />
          <span className="text-sm font-medium text-foreground">{device.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {device.room ? (
          <div className="flex items-center gap-1 text-sm text-foreground-muted">
            <MapPin className="h-3.5 w-3.5" />
            {device.room.name}
          </div>
        ) : (
          <span className="text-sm text-foreground-dim">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ProtocolBadge protocol={device.protocol} />
      </td>
      <td className="px-4 py-3">
        <FirmwareBadge firmware={device.firmware_type} />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-foreground-dim">
        {device.ip_address || '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-foreground-dim">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(device.last_seen)}
        </div>
      </td>
      <td className="px-4 py-3">
        {onClick && <ChevronRight className="h-4 w-4 text-foreground-dim" />}
      </td>
    </tr>
  )
}
