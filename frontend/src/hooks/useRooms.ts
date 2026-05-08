'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { roomsApi } from '@/lib/api'
import type { RoomFormData } from '@/types'

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.getAll(),
    staleTime: 60_000,
  })
}

export function useRoom(id: number | null) {
  return useQuery({
    queryKey: ['rooms', id],
    queryFn: () => roomsApi.getById(id!),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RoomFormData) => roomsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateRoom(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<RoomFormData>) => roomsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', id] })
      qc.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => roomsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
