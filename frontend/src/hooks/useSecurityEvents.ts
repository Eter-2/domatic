'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityApi, type SecurityFilters } from '@/lib/api'

export function useSecurityEvents(filters?: SecurityFilters) {
  return useQuery({
    queryKey: ['security-events', filters],
    queryFn: () => securityApi.getEvents(filters),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useSecurityStats() {
  return useQuery({
    queryKey: ['security-stats'],
    queryFn: () => securityApi.getStats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useResolveSecurityEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => securityApi.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['security-events'] })
      qc.invalidateQueries({ queryKey: ['security-stats'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
