'use client'

import { useState } from 'react'
import { HardDrive, AlertTriangle, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { firmwareApi } from '@/lib/api'
import { useDevices } from '@/hooks/useDevices'
import { FirmwareBadge } from '@/components/devices/FirmwareBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/lib/store'
import { formatDateTime } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Device, FirmwareUpdate } from '@/types'

const logSchema = z.object({
  device_id: z.number({ invalid_type_error: 'Select a device' }),
  to_firmware: z.string().min(1, 'Firmware version is required'),
  firmware_type: z.enum(['tasmota', 'esphome', 'original', 'custom', 'unknown']),
  notes: z.string().nullable(),
})

function LogUpdateModal({ open, onClose, devices }: { open: boolean; onClose: () => void; devices: Device[] }) {
  const qc = useQueryClient()
  const { addToast } = useAppStore()
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(logSchema),
    defaultValues: { device_id: undefined, to_firmware: '', firmware_type: 'tasmota' as const, notes: null },
  })

  const mutation = useMutation({
    mutationFn: firmwareApi.logUpdate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firmware-history'] })
      qc.invalidateQueries({ queryKey: ['firmware-attention'] })
      addToast({ title: 'Firmware update logged', variant: 'success' })
      reset()
      onClose()
    },
    onError: () => addToast({ title: 'Failed to log update', variant: 'error' }),
  })

  return (
    <Modal open={open} onClose={onClose} title="Log Firmware Update" size="md">
      <form onSubmit={handleSubmit((d) => mutation.mutateAsync({ ...d, device_id: Number(d.device_id), notes: d.notes || null }))} className="space-y-4">
        <Select
          label="Device"
          placeholder="Select a device…"
          options={devices.map((d) => ({ label: d.name, value: d.id }))}
          error={errors.device_id?.message}
          {...register('device_id', { valueAsNumber: true })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Firmware Version" placeholder="14.3.0" error={errors.to_firmware?.message} {...register('to_firmware')} />
          <Select
            label="Firmware Type"
            options={[
              { label: 'Tasmota', value: 'tasmota' },
              { label: 'ESPHome', value: 'esphome' },
              { label: 'Original', value: 'original' },
              { label: 'Custom', value: 'custom' },
              { label: 'Unknown', value: 'unknown' },
            ]}
            {...register('firmware_type')}
          />
        </div>
        <Textarea label="Notes" placeholder="Optional notes about this update" rows={2} {...register('notes', { setValueAs: (v) => v || null })} />
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending} className="flex-1">Log Update</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function FirmwarePage() {
  const [logModal, setLogModal] = useState(false)
  const [expandedDevice, setExpandedDevice] = useState<number | null>(null)

  const { data: attentionDevices = [], isLoading: attentionLoading } = useQuery({
    queryKey: ['firmware-attention'],
    queryFn: () => firmwareApi.getDevicesNeedingAttention(),
  })

  const { data: historyData } = useQuery({
    queryKey: ['firmware-history'],
    queryFn: () => firmwareApi.getHistory(),
  })

  const { data: allDevicesData } = useDevices()
  const allDevices = allDevicesData?.items ?? []
  const history = historyData ?? []

  // Group history by device
  const historyByDevice = history.reduce<Record<number, FirmwareUpdate[]>>((acc, item) => {
    acc[item.device_id] = acc[item.device_id] ?? []
    acc[item.device_id].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Firmware Manager</h1>
          <p className="text-sm text-foreground-muted">Track and manage device firmware</p>
        </div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setLogModal(true)}>
          Log Update
        </Button>
      </div>

      {/* Needs Attention */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-400">Needs Attention</h2>
          {attentionDevices.length > 0 && (
            <Badge variant="warning">{attentionDevices.length}</Badge>
          )}
        </div>
        {attentionLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : attentionDevices.length === 0 ? (
          <p className="text-sm text-emerald-400 flex items-center gap-2">
            All devices are running custom firmware — nothing to flag.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Current Firmware</th>
                <th>Chip</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attentionDevices.map((device) => (
                <tr key={device.id} className="border-b border-border">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{device.name}</td>
                  <td className="px-4 py-3"><FirmwareBadge firmware={device.firmware_type} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{device.chip_type ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="warning" dot>Needs custom firmware</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Flash History */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Flash History</h2>
        {allDevices.length === 0 ? (
          <EmptyState
            icon={<HardDrive className="h-8 w-8" />}
            title="No firmware history"
            description="Log your first firmware update to track changes"
          />
        ) : (
          <div className="space-y-2">
            {allDevices.filter((d) => historyByDevice[d.id]?.length).map((device) => {
              const deviceHistory = historyByDevice[device.id] ?? []
              const expanded = expandedDevice === device.id
              return (
                <div key={device.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedDevice(expanded ? null : device.id)}
                    className="flex w-full items-center justify-between px-5 py-4 hover:bg-surface transition-colors"
                    aria-expanded={expanded}
                  >
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-4 w-4 text-foreground-dim" />
                      <span className="text-sm font-medium text-foreground">{device.name}</span>
                      <FirmwareBadge firmware={device.firmware_type} />
                      <Badge variant="default">{deviceHistory.length} updates</Badge>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-foreground-dim" /> : <ChevronDown className="h-4 w-4 text-foreground-dim" />}
                  </button>
                  {expanded && (
                    <div className="border-t border-border">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Type</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deviceHistory.map((update) => (
                            <tr key={update.id} className="border-b border-border">
                              <td className="px-4 py-3 text-xs text-foreground-muted">{formatDateTime(update.created_at)}</td>
                              <td className="px-4 py-3 font-mono text-xs text-foreground-dim">{update.from_firmware ?? '—'}</td>
                              <td className="px-4 py-3 font-mono text-xs text-foreground">{update.to_firmware}</td>
                              <td className="px-4 py-3"><FirmwareBadge firmware={update.firmware_type} /></td>
                              <td className="px-4 py-3 text-xs text-foreground-muted">{update.notes ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <LogUpdateModal open={logModal} onClose={() => setLogModal(false)} devices={allDevices} />
    </div>
  )
}
