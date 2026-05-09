'use client'

import { useState } from 'react'
import { Building2, Upload } from 'lucide-react'
import { IFCViewer } from '@/components/bim/IFCViewer'
import { BimModelList } from '@/components/bim/BimModelList'
import { BimModelUpload } from '@/components/bim/BimModelUpload'
import type { BimModel } from '@/hooks/useBim'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1'

export default function BimPage() {
  const [selectedModel, setSelectedModel] = useState<BimModel | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            Modelos BIM
          </h1>
          <p className="text-sm text-foreground-muted">
            Plantas e modelos IFC da habitação
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors"
        >
          <Upload className="h-4 w-4" />
          Carregar modelo
        </button>
      </div>

      {showUpload && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Novo modelo IFC</h2>
          <BimModelUpload onSuccess={() => setShowUpload(false)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Model list */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Modelos disponíveis</h2>
          <BimModelList
            selectedId={selectedModel?.id ?? null}
            onSelect={setSelectedModel}
            apiBaseUrl={API_BASE}
          />
        </div>

        {/* Viewer */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4" style={{ minHeight: 500 }}>
          {selectedModel ? (
            <>
              <h2 className="text-sm font-semibold text-foreground mb-3">
                {selectedModel.nome}
                <span className="ml-2 text-xs font-normal text-foreground-dim">
                  v{selectedModel.versao} · {selectedModel.tamanho_mb} MB
                </span>
              </h2>
              <div className="h-[calc(100%-2rem)]" style={{ minHeight: 420 }}>
                <IFCViewer model={selectedModel} apiBaseUrl={API_BASE} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <Building2 className="h-12 w-12 text-foreground-dim mb-4" />
              <p className="text-sm font-medium text-foreground">Nenhum modelo seleccionado</p>
              <p className="text-xs text-foreground-muted mt-1">
                Seleccione um modelo da lista ou carregue um ficheiro IFC
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
