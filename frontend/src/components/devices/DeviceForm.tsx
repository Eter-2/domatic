'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Device, DeviceFormData } from '@/types'
import type { Room } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  room_id: z.number().nullable(),
  protocol: z.enum(['wifi', 'zigbee', 'zwave', 'bluetooth', 'matter', 'thread', 'other']),
  firmware_type: z.enum(['tasmota', 'esphome', 'original', 'unknown', 'custom']),
  chip_type: z.string().nullable(),
  ip_address: z.string().nullable(),
  mac_address: z.string().nullable(),
  mqtt_topic: z.string().nullable(),
})

interface DeviceFormProps {
  defaultValues?: Partial<Device>
  rooms: Room[]
  onSubmit: (data: DeviceFormData) => void | Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function DeviceForm({ defaultValues, rooms, onSubmit, onCancel, isLoading }: DeviceFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeviceFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      room_id: defaultValues?.room_id ?? null,
      protocol: defaultValues?.protocol ?? 'wifi',
      firmware_type: defaultValues?.firmware_type ?? 'unknown',
      chip_type: defaultValues?.chip_type ?? null,
      ip_address: defaultValues?.ip_address ?? null,
      mac_address: defaultValues?.mac_address ?? null,
      mqtt_topic: defaultValues?.mqtt_topic ?? null,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Device Name"
        placeholder="Living Room Switch"
        error={errors.name?.message}
        {...register('name')}
      />
      <Select
        label="Room"
        placeholder="No Room"
        options={rooms.map((r) => ({ label: r.name, value: r.id }))}
        error={errors.room_id?.message}
        {...register('room_id', { setValueAs: (v) => (v === '' ? null : Number(v)) })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Protocol"
          options={[
            { label: 'Wi-Fi', value: 'wifi' },
            { label: 'Zigbee', value: 'zigbee' },
            { label: 'Z-Wave', value: 'zwave' },
            { label: 'Bluetooth', value: 'bluetooth' },
            { label: 'Matter', value: 'matter' },
            { label: 'Thread', value: 'thread' },
            { label: 'Other', value: 'other' },
          ]}
          error={errors.protocol?.message}
          {...register('protocol')}
        />
        <Select
          label="Firmware"
          options={[
            { label: 'Tasmota', value: 'tasmota' },
            { label: 'ESPHome', value: 'esphome' },
            { label: 'Original', value: 'original' },
            { label: 'Custom', value: 'custom' },
            { label: 'Unknown', value: 'unknown' },
          ]}
          error={errors.firmware_type?.message}
          {...register('firmware_type')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="IP Address"
          placeholder="192.168.1.100"
          error={errors.ip_address?.message}
          {...register('ip_address', { setValueAs: (v) => v || null })}
        />
        <Input
          label="MAC Address"
          placeholder="AA:BB:CC:DD:EE:FF"
          error={errors.mac_address?.message}
          {...register('mac_address', { setValueAs: (v) => v || null })}
        />
      </div>
      <Input
        label="MQTT Topic"
        placeholder="stat/device/RESULT"
        error={errors.mqtt_topic?.message}
        {...register('mqtt_topic', { setValueAs: (v) => v || null })}
      />
      <Select
        label="Chip Type"
        placeholder="Unknown"
        options={[
          { label: 'ESP8266', value: 'esp8266' },
          { label: 'ESP32', value: 'esp32' },
          { label: 'ESP32-S2', value: 'esp32s2' },
          { label: 'ESP32-S3', value: 'esp32s3' },
          { label: 'ESP32-C3', value: 'esp32c3' },
          { label: 'nRF52', value: 'nrf52' },
          { label: 'Other', value: 'other' },
        ]}
        error={errors.chip_type?.message}
        {...register('chip_type', { setValueAs: (v) => v || null })}
      />
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isLoading} className="flex-1">
          {defaultValues?.id ? 'Save Changes' : 'Add Device'}
        </Button>
      </div>
    </form>
  )
}
