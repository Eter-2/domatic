'use client'

import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { useUploadBimModel } from '@/hooks/useBim'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface BimModelUploadProps {
  onSuccess?: () => void
}

export function BimModelUpload({ onSuccess }: BimModelUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [versao, setVersao] = useState('v1')
  const [descricao, setDescricao] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = useUploadBimModel()

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && ['.ifc', '.ifczip', '.ifcxml'].some(ext => dropped.name.toLowerCase().endsWith(ext))) {
      setFile(dropped)
    }
  }

  const handleSubmit = async () => {
    if (!file) return
    try {
      await upload.mutateAsync({ file, versao, descricao: descricao || undefined })
      setFile(null)
      setVersao('v1')
      setDescricao('')
      onSuccess?.()
    } catch { /* error displayed below */ }
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent/50 bg-surface'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".ifc,.ifczip,.ifcxml"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <p className="font-medium text-sm text-foreground">{file.name}</p>
            <p className="text-xs text-foreground-muted mt-1">{(file.size / 1048576).toFixed(1)} MB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-foreground-dim" />
            <p className="text-sm font-medium text-foreground">Arraste um ficheiro IFC ou clique</p>
            <p className="text-xs text-foreground-dim">.ifc · .ifczip · .ifcxml · máx. 200 MB</p>
          </div>
        )}
      </div>

      {file && (
        <>
          <div className="flex gap-2">
            <Input
              label="Versão"
              value={versao}
              onChange={e => setVersao(e.target.value)}
              className="w-24"
            />
            <Input
              label="Descrição (opcional)"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={upload.isPending}
            variant="primary"
            className="w-full"
          >
            {upload.isPending ? 'A carregar…' : 'Carregar Modelo BIM'}
          </Button>
          {upload.isError && (
            <p className="text-xs text-red-400">Erro ao carregar. Verifique o formato do ficheiro.</p>
          )}
        </>
      )}
    </div>
  )
}
