'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { automationsApi } from '@/lib/api'
import type { Automation } from '@/types'

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: () => automationsApi.getAll(),
    staleTime: 30_000,
  })
}

export function useAutomation(id: number | null) {
  return useQuery({
    queryKey: ['automations', id],
    queryFn: () => automationsApi.getById(id!),
    enabled: id !== null,
  })
}

export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Automation>) => automationsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  })
}

export function useUpdateAutomation(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Automation>) => automationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', id] })
      qc.invalidateQueries({ queryKey: ['automations'] })
    },
  })
}

export function useDeleteAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => automationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  })
}

export function useToggleAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      automationsApi.toggle(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ['automations'] })
      const previous = qc.getQueryData<Automation[]>(['automations'])
      qc.setQueryData<Automation[]>(['automations'], (old) =>
        old?.map((a) => (a.id === id ? { ...a, enabled } : a))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['automations'], context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  })
}

export function useTestAutomation() {
  return useMutation({
    mutationFn: (id: number) => automationsApi.test(id),
  })
}
