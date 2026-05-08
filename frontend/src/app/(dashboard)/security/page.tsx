'use client'

import { useState } from 'react'
import { ShieldAlert, Shield, AlertTriangle, AlertOctagon, Info } from 'lucide-react'
import { useSecurityEvents, useSecurityStats, useResolveSecurityEvent } from '@/hooks/useSecurityEvents'
import { EventRow } from '@/components/security/EventRow'
import { SeverityBadge } from '@/components/security/SeverityBadge'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton, StatCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { Select } from '@/components/ui/Input'
import { useAppStore } from '@/lib/store'

export default function SecurityPage() {
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterResolved, setFilterResolved] = useState('')
  const { addToast } = useAppStore()

  const { data, isLoading, error } = useSecurityEvents({
    severity: filterSeverity || undefined,
    resolved: filterResolved === '' ? undefined : filterResolved === 'true',
  })
  const { data: stats, isLoading: statsLoading } = useSecurityStats()
  const resolveEvent = useResolveSecurityEvent()

  const events = data?.items ?? []

  const handleResolve = async (id: number) => {
    try {
      await resolveEvent.mutateAsync(id)
      addToast({ title: 'Event resolved', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to resolve event', variant: 'error' })
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground">Security</h1>
        <p className="text-sm text-foreground-muted">Monitor and respond to security events</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Critical" value={stats?.critical ?? 0} icon={<AlertOctagon className="h-5 w-5" />} variant={stats?.critical ? 'danger' : 'default'} />
            <StatCard label="High" value={stats?.high ?? 0} icon={<AlertTriangle className="h-5 w-5" />} variant={stats?.high ? 'warning' : 'default'} />
            <StatCard label="Medium" value={stats?.medium ?? 0} icon={<ShieldAlert className="h-5 w-5" />} variant="default" />
            <StatCard label="Low" value={stats?.low ?? 0} icon={<Shield className="h-5 w-5" />} variant="info" />
            <StatCard label="Info" value={stats?.info ?? 0} icon={<Info className="h-5 w-5" />} variant="default" />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          options={[
            { label: 'All severities', value: '' },
            { label: 'Critical', value: 'critical' },
            { label: 'High', value: 'high' },
            { label: 'Medium', value: 'medium' },
            { label: 'Low', value: 'low' },
            { label: 'Info', value: 'info' },
          ]}
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="w-40"
        />
        <Select
          options={[
            { label: 'All events', value: '' },
            { label: 'Unresolved', value: 'false' },
            { label: 'Resolved', value: 'true' },
          ]}
          value={filterResolved}
          onChange={(e) => setFilterResolved(e.target.value)}
          className="w-36"
        />
        <span className="text-sm text-foreground-muted ml-auto">
          {data?.total ?? 0} events
        </span>
      </div>

      {/* Events table */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card">
          <TableSkeleton rows={8} cols={7} />
        </div>
      ) : error ? (
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" />}
          title="Failed to load security events"
          description="Check your API connection"
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-8 w-8" />}
          title="No security events"
          description={filterSeverity || filterResolved ? 'No events match your filters' : 'Your network looks clean'}
          className="py-16"
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Device</th>
                <th>Type</th>
                <th>Description</th>
                <th>Network</th>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onResolve={event.resolved ? undefined : handleResolve}
                  isResolving={resolveEvent.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
