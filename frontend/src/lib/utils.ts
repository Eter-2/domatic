import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never'
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm:ss')
  } catch {
    return dateString
  }
}

export function formatTime(dateString: string | null): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'HH:mm:ss')
  } catch {
    return dateString
  }
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function classifyMqttTopic(topic: string): string {
  const parts = topic.split('/')
  if (parts.length > 2) return parts.slice(0, 2).join('/') + '/…'
  return topic
}

export function getProtocolColor(protocol: string): string {
  const map: Record<string, string> = {
    wifi: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    zigbee: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    zwave: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    bluetooth: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    matter: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    thread: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
    other: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  }
  return map[protocol] ?? map.other
}

export function getFirmwareColor(firmware: string): string {
  const map: Record<string, string> = {
    tasmota: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    esphome: 'text-green-400 bg-green-400/10 border-green-400/20',
    original: 'text-red-400 bg-red-400/10 border-red-400/20',
    unknown: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    custom: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  }
  return map[firmware] ?? map.unknown
}

export function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10 border-red-400/20',
    high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    info: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  }
  return map[severity] ?? map.info
}

export function getSeverityDot(severity: string): string {
  const map: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-blue-500',
    info: 'bg-slate-500',
  }
  return map[severity] ?? map.info
}
