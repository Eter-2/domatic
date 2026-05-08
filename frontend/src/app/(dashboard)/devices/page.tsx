'use client'

import { useState } from 'react'
import { Plus, Grid, List, Search, Filter, Cpu } from 'lucide-react'
import { useDevices, useCreateDevice, useUpdateDevice, useDeleteDevice } from '@/hooks/useDevices'
import { useRooms } from '@/hooks/useRooms'
import { DeviceCard } from '@/components/devices/DeviceCard'
import { DeviceRow } from '@/components/devices/DeviceRow'
import { DeviceDrawer } from '@/components/devices/DeviceDrawer'
import { DeviceForm } from '@/components/devices/DeviceForm'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useAppStore } from '@/lib/store'
import type { Device, DeviceFormData } from '@/types'

type ViewMode = 'grid' | 'table'

export default function DevicesPage() {
  const [view, setView] = useState<ViewMode>('table')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProtocol, setFilterProtocol] = useState('')
  const [filterFirmware, setFilterFirmware] = useState('')
  const [filterOnline, setFilterOnline] = useState('')

  const { addToast } = useAppStore()

  const { data, isLoading, error } = useDevices({
    search: search || undefined,
    protocol: filterProtocol || undefined,
    firmware_type: filterFirmware || undefined,
    is_online: filterOnline === '' ? undefined : filterOnline === 'true',
  })

  const { data: rooms = [] } = useRooms()
  const createDevice = useCreateDevice()

  const devices = data?.items ?? []

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device)
    setDrawerOpen(true)
  }

  const handleCreate = async (formData: DeviceFormData) => {
    try {
      await createDevice.mutateAsync(formData)
      addToast({ title: 'Device added successfully', variant: 'success' })
      setAddModalOpen(false)
    } catch {
      addToast({ title: 'Failed to add device', variant: 'error' })
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Devices</h1>
          <p className="text-sm text-foreground-muted">
            {data?.total ?? 0} devices registered
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Device
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Input
            placeholder="Search devices…"
            leftAddon={<Search className="h-3.5 w-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={[
            { label: 'All protocols', value: '' },
            { label: 'Wi-Fi', value: 'wifi' },
            { label: 'Zigbee', value: 'zigbee' },
            { label: 'Z-Wave', value: 'zwave' },
            { label: 'Bluetooth', value: 'bluetooth' },
            { label: 'Matter', value: 'matter' },
          ]}
          value={filterProtocol}
          onChange={(e) => setFilterProtocol(e.target.value)}
          className="w-36"
        />
        <Select
          options={[
            { label: 'All firmware', value: '' },
            { label: 'Tasmota', value: 'tasmota' },
            { label: 'ESPHome', value: 'esphome' },
            { label: 'Original', value: 'original' },
            { label: 'Unknown', value: 'unknown' },
          ]}
          value={filterFirmware}
          onChange={(e) => setFilterFirmware(e.target.value)}
          className="w-36"
        />
        <Select
          options={[
            { label: 'Any status', value: '' },
            { label: 'Online', value: 'true' },
            { label: 'Offline', value: 'false' },
          ]}
          value={filterOnline}
          onChange={(e) => setFilterOnline(e.target.value)}
          className="w-32"
        />
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            onClick={() => setView('table')}
            className={`rounded-md p-1.5 transition-colors ${view === 'table' ? 'bg-card text-foreground' : 'text-foreground-dim hover:text-foreground'}`}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`rounded-md p-1.5 transition-colors ${view === 'grid' ? 'bg-card text-foreground' : 'text-foreground-dim hover:text-foreground'}`}
            aria-label="Grid view"
          >
            <Grid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card">
          <TableSkeleton rows={8} cols={6} />
        </div>
      ) : error ? (
        <EmptyState
          icon={<Cpu className="h-8 w-8" />}
          title="Failed to load devices"
          description="Check your API connection"
        />
      ) : devices.length === 0 ? (
        <EmptyState
          icon={<Cpu className="h-8 w-8" />}
          title="No devices found"
          description={search || filterProtocol || filterFirmware ? 'Try adjusting your filters' : 'Add your first smart device to get started'}
          action={
            !search && !filterProtocol && !filterFirmware ? (
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddModalOpen(true)}>
                Add Device
              </Button>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onClick={() => handleDeviceClick(device)}
              selected={selectedDevice?.id === device.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Room</th>
                <th>Protocol</th>
                <th>Firmware</th>
                <th>IP Address</th>
                <th>Last Seen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  onClick={() => handleDeviceClick(device)}
                  selected={selectedDevice?.id === device.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Device detail drawer */}
      <DeviceDrawer
        device={selectedDevice}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Add device modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Device"
        description="Register a new IoT device to your hub"
        size="lg"
      >
        <DeviceForm
          rooms={rooms}
          onSubmit={handleCreate}
          onCancel={() => setAddModalOpen(false)}
          isLoading={createDevice.isPending}
        />
      </Modal>
    </div>
  )
}
