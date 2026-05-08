'use client'

import { useState } from 'react'
import { Plus, Home, Edit, Trash2, Cpu } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from '@/hooks/useRooms'
import { useDevices } from '@/hooks/useDevices'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { OnlineIndicator } from '@/components/devices/OnlineIndicator'
import { DeviceCard } from '@/components/devices/DeviceCard'
import { DeviceDrawer } from '@/components/devices/DeviceDrawer'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { useAppStore } from '@/lib/store'
import type { Room, RoomFormData, Device } from '@/types'

const roomSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().nullable(),
  icon: z.string().nullable(),
})

function RoomFormFields({ onSubmit, onCancel, defaultValues, isLoading }: {
  onSubmit: (data: RoomFormData) => void
  onCancel: () => void
  defaultValues?: Partial<Room>
  isLoading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? null,
      icon: defaultValues?.icon ?? null,
    },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Room Name" placeholder="Living Room" error={errors.name?.message} {...register('name')} />
      <Textarea label="Description" placeholder="Optional description" rows={2} {...register('description', { setValueAs: (v) => v || null })} />
      <Input label="Icon (emoji)" placeholder="🛋️" {...register('icon', { setValueAs: (v) => v || null })} />
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" variant="primary" loading={isLoading} className="flex-1">
          {defaultValues?.id ? 'Save Changes' : 'Create Room'}
        </Button>
      </div>
    </form>
  )
}

export default function RoomsPage() {
  const { data: rooms = [], isLoading } = useRooms()
  const createRoom = useCreateRoom()
  const deleteRoom = useDeleteRoom()
  const { addToast } = useAppStore()
  const [addModal, setAddModal] = useState(false)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: devicesData } = useDevices({ room_id: selectedRoom?.id })
  const roomDevices = devicesData?.items ?? []

  const handleCreate = async (data: RoomFormData) => {
    try {
      await createRoom.mutateAsync(data)
      addToast({ title: 'Room created', variant: 'success' })
      setAddModal(false)
    } catch {
      addToast({ title: 'Failed to create room', variant: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this room? Devices will be unassigned.')) return
    try {
      await deleteRoom.mutateAsync(id)
      addToast({ title: 'Room deleted', variant: 'success' })
      if (selectedRoom?.id === id) setSelectedRoom(null)
    } catch {
      addToast({ title: 'Failed to delete room', variant: 'error' })
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rooms</h1>
          <p className="text-sm text-foreground-muted">{rooms.length} rooms configured</p>
        </div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddModal(true)}>
          Add Room
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={<Home className="h-8 w-8" />}
          title="No rooms yet"
          description="Create rooms to organize your devices by location"
          action={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddModal(true)}>Create Room</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`group rounded-xl border bg-card p-5 shadow-card cursor-pointer transition-all hover:bg-card-hover hover:border-accent/30 ${selectedRoom?.id === room.id ? 'border-accent bg-accent/5' : 'border-border'}`}
              onClick={() => setSelectedRoom(selectedRoom?.id === room.id ? null : room)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-xl">
                    {room.icon ?? <Home className="h-5 w-5 text-foreground-dim" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{room.name}</h3>
                    {room.description && <p className="text-xs text-foreground-muted">{room.description}</p>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" onClick={() => setEditRoom(room)} aria-label="Edit room">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="danger" onClick={() => handleDelete(room.id)} aria-label="Delete room">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <Cpu className="h-3.5 w-3.5 text-foreground-dim" />
                  <span className="text-foreground-muted">{room.device_count} devices</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <OnlineIndicator isOnline={room.online_count > 0} size="sm" />
                  <span className="text-xs text-foreground-muted">{room.online_count} online</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Devices in selected room */}
      {selectedRoom && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Devices in {selectedRoom.name}
          </h2>
          {roomDevices.length === 0 ? (
            <EmptyState
              icon={<Cpu className="h-6 w-6" />}
              title="No devices in this room"
              description="Assign devices to this room from the Devices page"
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {roomDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onClick={() => { setSelectedDevice(device); setDrawerOpen(true) }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Room" size="md">
        <RoomFormFields onSubmit={handleCreate} onCancel={() => setAddModal(false)} isLoading={createRoom.isPending} />
      </Modal>

      <Modal open={!!editRoom} onClose={() => setEditRoom(null)} title="Edit Room" size="md">
        {editRoom && (
          <EditRoomForm room={editRoom} onClose={() => setEditRoom(null)} />
        )}
      </Modal>

      <DeviceDrawer device={selectedDevice} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

function EditRoomForm({ room, onClose }: { room: Room; onClose: () => void }) {
  const updateRoom = useUpdateRoom(room.id)
  const { addToast } = useAppStore()

  const handleUpdate = async (data: RoomFormData) => {
    try {
      await updateRoom.mutateAsync(data)
      addToast({ title: 'Room updated', variant: 'success' })
      onClose()
    } catch {
      addToast({ title: 'Failed to update room', variant: 'error' })
    }
  }

  return <RoomFormFields onSubmit={handleUpdate} onCancel={onClose} defaultValues={room} isLoading={updateRoom.isPending} />
}
