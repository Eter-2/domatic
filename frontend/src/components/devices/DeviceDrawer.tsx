'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Send, RefreshCw, Clock, Activity } from 'lucide-react'
import { Drawer } from '@/components/ui/Modal'
import { JsonViewer } from '@/components/ui/JsonViewer'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { OnlineIndicator } from './OnlineIndicator'
import { ProtocolBadge } from './ProtocolBadge'
import { FirmwareBadge } from './FirmwareBadge'
import { useAppStore } from '@/lib/store'
import { useSendCommand } from '@/hooks/useDevices'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'
import type { Device } from '@/types'

const commandSchema = z.object({
  topic: z.string().min(1, 'Topic required'),
  payload: z.string().min(1, 'Payload required'),
  qos: z.number().min(0).max(2),
})

interface DeviceDrawerProps {
  device: Device | null
  open: boolean
  onClose: () => void
}

type Tab = 'state' | 'command' | 'info'

export function DeviceDrawer({ device, open, onClose }: DeviceDrawerProps) {
  const [tab, setTab] = useState<Tab>('state')
  const sendCommand = useSendCommand(device?.id ?? 0)
  const { addToast } = useAppStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(commandSchema),
    defaultValues: {
      topic: device?.mqtt_topic ?? '',
      payload: '{"POWER":"TOGGLE"}',
      qos: 0,
    },
  })

  const onSendCommand = handleSubmit(async (data) => {
    try {
      await sendCommand.mutateAsync({ ...data, qos: Number(data.qos) as 0 | 1 | 2 })
      addToast({ title: 'Command sent', variant: 'success' })
      reset()
    } catch {
      addToast({ title: 'Failed to send command', variant: 'error' })
    }
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'state', label: 'State' },
    { key: 'command', label: 'Command' },
    { key: 'info', label: 'Info' },
  ]

  return (
    <Drawer open={open} onClose={onClose} title={device?.name ?? 'Device Detail'}>
      {device && (
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <OnlineIndicator isOnline={device.is_online} size="lg" showLabel />
            <div className="h-4 w-px bg-border" />
            <ProtocolBadge protocol={device.protocol} />
            <FirmwareBadge firmware={device.firmware_type} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-surface p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* State tab */}
          {tab === 'state' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground-muted">Current State</h3>
                <div className="flex items-center gap-1 text-xs text-foreground-dim">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(device.last_seen)}
                </div>
              </div>
              <JsonViewer data={device.state} className="max-h-80" />
            </div>
          )}

          {/* Command tab */}
          {tab === 'command' && (
            <form onSubmit={onSendCommand} className="space-y-3">
              <Input
                label="MQTT Topic"
                placeholder="cmnd/device/Power"
                error={errors.topic?.message}
                {...register('topic')}
              />
              <Textarea
                label="Payload"
                placeholder='{"POWER":"ON"}'
                rows={4}
                error={errors.payload?.message}
                className="font-mono text-xs"
                {...register('payload')}
              />
              <Select
                label="QoS Level"
                options={[
                  { label: 'QoS 0 — At most once', value: 0 },
                  { label: 'QoS 1 — At least once', value: 1 },
                  { label: 'QoS 2 — Exactly once', value: 2 },
                ]}
                {...register('qos', { valueAsNumber: true })}
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                leftIcon={<Send className="h-4 w-4" />}
                loading={sendCommand.isPending}
              >
                Send Command
              </Button>
            </form>
          )}

          {/* Info tab */}
          {tab === 'info' && (
            <div className="space-y-3">
              {[
                { label: 'IP Address', value: device.ip_address },
                { label: 'MAC Address', value: device.mac_address },
                { label: 'MQTT Topic', value: device.mqtt_topic },
                { label: 'Chip Type', value: device.chip_type },
                { label: 'Last Seen', value: formatDateTime(device.last_seen) },
                { label: 'Added', value: formatDateTime(device.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <span className="text-sm text-foreground-muted">{label}</span>
                  <span className="font-mono text-xs text-foreground text-right">{value ?? '—'}</span>
                </div>
              ))}
              {Object.keys(device.config ?? {}).length > 0 && (
                <>
                  <h4 className="text-sm font-medium text-foreground-muted mt-4">Configuration</h4>
                  <JsonViewer data={device.config} className="max-h-60" />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
