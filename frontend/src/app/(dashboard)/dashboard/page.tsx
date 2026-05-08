'use client'

import { useQuery } from '@tanstack/react-query'
import { Cpu, Wifi, WifiOff, ShieldAlert, Zap, Home, Clock, Activity } from 'lucide-react'
import { dashboardApi } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageSkeleton } from '@/components/ui/LoadingSkeleton'
import { SeverityBadge } from '@/components/security/SeverityBadge'
import { OnlineIndicator } from '@/components/devices/OnlineIndicator'
import { useAppStore } from '@/lib/store'
import { formatRelativeTime, formatTime } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getSummary(),
    refetchInterval: 30_000,
  })
  const { liveSecurityEvents, liveAutomationActivity, mqttMessages } = useAppStore()

  if (isLoading) return <PageSkeleton />
  if (error) return (
    <EmptyState
      icon={<ShieldAlert className="h-8 w-8" />}
      title="Failed to load dashboard"
      description="Could not connect to the Dom'Atic API. Make sure the backend is running."
    />
  )

  const summary = data!
  const securityEvents = liveSecurityEvents.length > 0 ? liveSecurityEvents : summary.recent_security_events
  const automationActivity = liveAutomationActivity.length > 0 ? liveAutomationActivity : summary.recent_automation_activity
  const recentMqtt = mqttMessages.length > 0 ? mqttMessages.slice(0, 8) : summary.recent_mqtt_messages?.slice(0, 8)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-foreground-muted">Overview of your home automation system</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total Devices"
          value={summary.total_devices}
          icon={<Cpu className="h-5 w-5" />}
          variant="default"
        />
        <StatCard
          label="Online"
          value={summary.online_devices}
          icon={<Wifi className="h-5 w-5" />}
          variant="success"
        />
        <StatCard
          label="Offline"
          value={summary.offline_devices}
          icon={<WifiOff className="h-5 w-5" />}
          variant={summary.offline_devices > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Security Alerts"
          value={summary.unresolved_security_events}
          icon={<ShieldAlert className="h-5 w-5" />}
          variant={summary.unresolved_security_events > 0 ? 'danger' : 'default'}
          badge={summary.unresolved_security_events > 0 ? summary.unresolved_security_events : undefined}
        />
        <StatCard
          label="Active Automations"
          value={summary.active_automations}
          icon={<Zap className="h-5 w-5" />}
          variant="info"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Rooms */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Home className="h-4 w-4 text-accent" />
              Rooms
            </h2>
            <Link href="/rooms" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          {summary.rooms.length === 0 ? (
            <EmptyState
              title="No rooms yet"
              description="Add rooms to organize your devices"
              className="py-8"
            />
          ) : (
            <div className="space-y-2">
              {summary.rooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/rooms`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 hover:bg-card-hover transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{room.name}</p>
                    <p className="text-xs text-foreground-dim">{room.device_count} devices</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <OnlineIndicator isOnline={room.online_count === room.device_count && room.device_count > 0} size="sm" />
                    <span className="text-xs text-foreground-muted">
                      {room.online_count}/{room.device_count}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Security Events */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-accent" />
              Security Events
            </h2>
            <Link href="/security" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          {securityEvents.length === 0 ? (
            <EmptyState
              title="No security events"
              description="Your network looks clean"
              className="py-8"
            />
          ) : (
            <div className="space-y-2">
              {securityEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2.5 rounded-lg border border-border p-2.5"
                >
                  <SeverityBadge severity={event.severity} showIcon={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{event.event_type}</p>
                    <p className="truncate text-xs text-foreground-muted">{event.description}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-foreground-dim">
                    {formatRelativeTime(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MQTT + Automations */}
        <div className="space-y-4">
          {/* Recent MQTT */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" />
                MQTT Activity
              </h2>
              <Link href="/mqtt" className="text-xs text-accent hover:underline">Console</Link>
            </div>
            {!recentMqtt || recentMqtt.length === 0 ? (
              <p className="py-4 text-center text-xs text-foreground-dim font-mono">No messages yet</p>
            ) : (
              <div className="space-y-1">
                {recentMqtt.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2 font-mono text-[10px]">
                    <span className="text-foreground-dim w-14 flex-shrink-0">{formatTime(msg.timestamp)}</span>
                    <span className="truncate text-blue-400 flex-1">{msg.topic}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automation Activity */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" />
                Automation Activity
              </h2>
              <Link href="/automations" className="text-xs text-accent hover:underline">Manage</Link>
            </div>
            {automationActivity.length === 0 ? (
              <p className="py-4 text-center text-xs text-foreground-dim">No automations triggered yet</p>
            ) : (
              <div className="space-y-1.5">
                {automationActivity.slice(0, 4).map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${activity.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="truncate text-xs text-foreground">{activity.automation_name}</span>
                    </div>
                    <span className="flex-shrink-0 text-[10px] text-foreground-dim flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatRelativeTime(activity.triggered_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
