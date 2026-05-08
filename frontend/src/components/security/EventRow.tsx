'use client'

import { ArrowRight, CheckCircle, Clock } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'
import type { SecurityEvent } from '@/types'

interface EventRowProps {
  event: SecurityEvent
  onResolve?: (id: number) => void
  isResolving?: boolean
}

export function EventRow({ event, onResolve, isResolving }: EventRowProps) {
  return (
    <tr className="border-b border-border transition-colors hover:bg-surface">
      <td className="px-4 py-3">
        <SeverityBadge severity={event.severity} />
      </td>
      <td className="px-4 py-3 text-sm font-medium text-foreground">
        {event.device?.name ?? <span className="text-foreground-dim">Unknown Device</span>}
      </td>
      <td className="px-4 py-3">
        <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground-muted">
          {event.event_type}
        </span>
      </td>
      <td className="max-w-xs px-4 py-3 text-sm text-foreground-muted">
        <span className="line-clamp-2">{event.description}</span>
      </td>
      <td className="px-4 py-3">
        {event.source_ip && event.destination_ip ? (
          <div className="flex items-center gap-1 font-mono text-xs text-foreground-dim">
            <span>{event.source_ip}</span>
            <ArrowRight className="h-3 w-3 text-slate-600" />
            <span>{event.destination_ip}</span>
          </div>
        ) : (
          <span className="text-foreground-dim">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-foreground-dim">
          <Clock className="h-3 w-3" />
          {formatDateTime(event.created_at)}
        </div>
      </td>
      <td className="px-4 py-3">
        {event.resolved ? (
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Resolved
          </div>
        ) : onResolve ? (
          <Button
            size="sm"
            variant="ghost"
            loading={isResolving}
            onClick={() => onResolve(event.id)}
            aria-label={`Resolve security event ${event.id}`}
          >
            Resolve
          </Button>
        ) : null}
      </td>
    </tr>
  )
}
