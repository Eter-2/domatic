'use client'

import { useEffect, useRef, useState } from 'react'
import { getAccessToken } from '@/lib/api'
import type { BimModel } from '@/hooks/useBim'

interface IFCViewerProps {
  model: BimModel
  apiBaseUrl: string
}

export function IFCViewer({ model, apiBaseUrl }: IFCViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const componentsRef = useRef<any>(null) // OBC has no public types

  const downloadUrl = `${apiBaseUrl}/bim/${model.id}/download`

  useEffect(() => {
    let cancelled = false

    async function initViewer() {
      if (!containerRef.current) return
      try {
        const OBC = await import('@thatopen/components').catch(() => null)
        if (!OBC || cancelled) { setState('unsupported'); return }

        const components = new OBC.Components() as any // OBC has no public types
        componentsRef.current = components

        const worlds = components.get(OBC.Worlds)
        const world = worlds.create()
        world.scene = new OBC.SimpleScene(components)
        world.renderer = new OBC.SimpleRenderer(components, containerRef.current)
        world.camera = new OBC.SimpleCamera(components)
        components.init()
        world.scene.setup()
        world.camera.controls.setLookAt(12, 6, 8, 0, 0, -10)

        const fragments = components.get(OBC.FragmentsManager)
        const workerUrl = await OBC.FragmentsManager.getWorker()
        await fragments.init(workerUrl)
        if (cancelled) return

        const token = getAccessToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await fetch(downloadUrl, { headers })
        if (!response.ok) throw new Error(`Download falhou: ${response.status}`)
        const buffer = await response.arrayBuffer()
        if (cancelled) return

        const loader = components.get(OBC.IfcLoader)
        await loader.setup({
          autoSetWasm: false,
          wasm: { path: `${window.location.origin}/web-ifc/`, absolute: true },
        })
        const ifcModel = await loader.load(new Uint8Array(buffer), true, model.nome)
        world.scene.three.add(ifcModel.object ?? ifcModel)

        if (!cancelled) setState('ready')
      } catch (err) {
        if (!cancelled) {
          setState('error')
          setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar modelo')
        }
      }
    }

    initViewer()
    return () => {
      cancelled = true
      if (componentsRef.current) {
        try { componentsRef.current.dispose() } catch { /* ignore */ }
        componentsRef.current = null
      }
    }
  }, [model.id, model.nome, downloadUrl])

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-[#0f1117]" style={{ minHeight: 400 }}>
      <div ref={containerRef} className="w-full h-full" />

      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f1117]">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent mx-auto mb-3" />
            <p className="text-sm">A carregar modelo IFC…</p>
            <p className="text-xs text-foreground-dim mt-1">{model.nome} · {model.tamanho_mb} MB</p>
          </div>
        </div>
      )}

      {(state === 'unsupported' || state === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📐</div>
          <h3 className="font-semibold text-foreground mb-1">{model.nome}</h3>
          <p className="text-sm text-foreground-muted mb-4">v{model.versao} · {model.tamanho_mb} MB</p>
          {state === 'error' && (
            <p className="text-xs text-yellow-500 mb-4 bg-yellow-500/10 px-3 py-2 rounded">
              {errorMsg}
            </p>
          )}
          <a
            href={downloadUrl}
            download={model.nome}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            ↓ Descarregar {model.nome}
          </a>
          <p className="text-xs text-foreground-dim mt-3">
            Compatível com Autodesk Revit, ArchiCAD, BIMvision e qualquer software IFC
          </p>
        </div>
      )}
    </div>
  )
}
