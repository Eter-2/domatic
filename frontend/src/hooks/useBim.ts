'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

export interface BimModel {
  id: string
  nome: string
  versao: string
  descricao?: string
  tamanho_bytes: number
  tamanho_mb: number
  mime_type: string
  estado: 'uploading' | 'processing' | 'ready' | 'error'
  created_by: string
  created_at: string
}

export function useBimModels() {
  return useQuery<BimModel[]>({
    queryKey: ['bim'],
    queryFn: async () => {
      const { data } = await apiClient.get('/bim')
      return data.items ?? []
    },
  })
}

export function useUploadBimModel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      file,
      versao,
      descricao,
    }: {
      file: File
      versao: string
      descricao?: string
    }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('versao', versao)
      if (descricao) formData.append('descricao', descricao)
      const { data } = await apiClient.post('/bim', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bim'] }),
  })
}

export function useDeleteBimModel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (modelId: string) => apiClient.delete(`/bim/${modelId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bim'] }),
  })
}
