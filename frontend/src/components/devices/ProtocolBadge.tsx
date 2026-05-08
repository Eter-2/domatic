import { Wifi, Radio, Bluetooth, Cpu, Share2, Layers } from 'lucide-react'
import { cn, getProtocolColor } from '@/lib/utils'
import type { Protocol } from '@/types'

const PROTOCOL_ICONS: Record<Protocol, typeof Wifi> = {
  wifi: Wifi,
  zigbee: Radio,
  zwave: Radio,
  bluetooth: Bluetooth,
  matter: Layers,
  thread: Share2,
  other: Cpu,
}

const PROTOCOL_LABELS: Record<Protocol, string> = {
  wifi: 'Wi-Fi',
  zigbee: 'Zigbee',
  zwave: 'Z-Wave',
  bluetooth: 'BT',
  matter: 'Matter',
  thread: 'Thread',
  other: 'Other',
}

interface ProtocolBadgeProps {
  protocol: Protocol
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProtocolBadge({ protocol, showLabel = true, size = 'md', className }: ProtocolBadgeProps) {
  const Icon = PROTOCOL_ICONS[protocol] ?? PROTOCOL_ICONS.other
  const label = PROTOCOL_LABELS[protocol] ?? protocol

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        getProtocolColor(protocol),
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        className
      )}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {showLabel && label}
    </span>
  )
}
