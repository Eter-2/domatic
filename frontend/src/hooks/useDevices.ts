'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { devicesApi, type DeviceFilters } from '@/lib/api'
import type { DeviceFormData, CommandFormData } from '@/types'

export function useDevices(filters?: DeviceFilters) {
  return useQuery({
    queryKey: ['devices', filters],
    queryFn: () => devicesApi.getAll(filters),
    staleTime: 30_000,
  })
}

export function useDevice(id: number | null) {
  return useQuery({
    queryKey: ['devices', id],
    queryFn: () => devicesApi.getById(id!),
    enabled: id !== null,
    staleTime: 15_000,
  })
}

export function useCreateDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DeviceFormData) => devicesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateDevice(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<DeviceFormData>) => devicesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices', id] })
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export function useDeleteDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => devicesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSendCommand(deviceId: number) {
  return useMutation({
    mutationFn: (data: CommandFormData) => devicesApi.sendCommand(deviceId, data),
  })
}

export function useDeviceHistory(deviceId: number | null, hours = 24) {
  return useQuery({
    queryKey: ['device-history', deviceId, hours],
    queryFn: () => devicesApi.getHistory(deviceId!, hours),
    enabled: deviceId !== null,
    staleTime: 60_000,
  })
}
