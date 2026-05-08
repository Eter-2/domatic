import { Zap, Home, HelpCircle, Code, Settings } from 'lucide-react'
import { cn, getFirmwareColor } from '@/lib/utils'
import type { FirmwareType } from '@/types'

const FIRMWARE_ICONS: Record<FirmwareType, typeof Zap> = {
  tasmota: Zap,
  esphome: Home,
  original: Settings,
  unknown: HelpCircle,
  custom: Code,
}

const FIRMWARE_LABELS: Record<FirmwareType, string> = {
  tasmota: 'Tasmota',
  esphome: 'ESPHome',
  original: 'Original',
  unknown: 'Unknown',
  custom: 'Custom',
}

interface FirmwareBadgeProps {
  firmware: FirmwareType
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function FirmwareBadge({ firmware, showLabel = true, size = 'md', className }: FirmwareBadgeProps) {
  const Icon = FIRMWARE_ICONS[firmware] ?? FIRMWARE_ICONS.unknown
  const label = FIRMWARE_LABELS[firmware] ?? firmware

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        getFirmwareColor(firmware),
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        className
      )}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {showLabel && label}
    </span>
  )
}
