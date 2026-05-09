'use client'

import { Trash2, Download } from 'lucide-react'
import { useBimModels, useDeleteBimModel, type BimModel } from '@/hooks/useBim'

const ESTADO: Record<string, { label: string; className: string }> = {
  ready:      { label: 'Pronto',        className: 'bg-emerald-500/10 text-emerald-400' },
  uploading:  { label: 'A carregar',    className: 'bg-blue-500/10 text-blue-400' },
  processing: { label: 'A processar',   className: 'bg-yellow-500/10 text-yellow-400' },
  error:      { label: 'Erro',          className: 'bg-red-500/10 text-red-400' },
}

interface BimModelListProps {
  selectedId: string | null
  onSelect: (model: BimModel) => void
  apiBaseUrl: string
}

export function BimModelList({ selectedId, onSelect, apiBaseUrl }: BimModelListProps) {
  const { data: models, isLoading } = useBimModels()
  const deleteModel = useDeleteBimModel()

  if (isLoading) return <p className="p-4 text-sm text-foreground-dim">A carregar modelos…</p>

  if (!models?.length) return (
    <div className="p-6 text-center text-sm text-foreground-muted">
      <p className="font-medium text-foreground mb-1">Sem modelos BIM</p>
      <p>Faça upload de um ficheiro IFC para começar.</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {models.map((model) => {
        const estado = ESTADO[model.estado] ?? ESTADO.error
        const isSelected = model.id === selectedId
        return (
          <div
            key={model.id}
            onClick={() => model.estado === 'ready' && onSelect(model)}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              isSelected
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/30 bg-surface'
            } ${model.estado !== 'ready' ? 'opacity-50 cursor-default' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{model.nome}</p>
                <p className="text-xs text-foreground-dim mt-0.5">
                  v{model.versao} · {model.tamanho_mb} MB
                </p>
                {model.descricao && (
                  <p className="text-xs text-foreground-muted mt-0.5 italic">{model.descricao}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estado.className}`}>
                  {estado.label}
                </span>
                <div className="flex gap-1">
                  <a
                    href={`${apiBaseUrl}/bim/${model.id}/download`}
                    download={model.nome}
                    onClick={(e) => e.stopPropagation()}
                    className="text-foreground-dim hover:text-accent p-1"
                    title="Descarregar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Eliminar modelo BIM?')) deleteModel.mutate(model.id)
                    }}
                    className="text-foreground-dim hover:text-red-400 p-1"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
