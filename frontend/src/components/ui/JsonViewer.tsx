'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JsonViewerProps {
  data: unknown
  className?: string
  initialExpanded?: boolean
}

interface JsonNodeProps {
  keyName?: string
  value: unknown
  depth?: number
}

function JsonNode({ keyName, value, depth = 0 }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isExpandable = isObject || isArray

  const renderValue = () => {
    if (value === null) return <span className="text-slate-500">null</span>
    if (value === undefined) return <span className="text-slate-500">undefined</span>
    if (typeof value === 'boolean') return <span className="text-amber-400">{String(value)}</span>
    if (typeof value === 'number') return <span className="text-blue-400">{String(value)}</span>
    if (typeof value === 'string') return <span className="text-emerald-400">&quot;{value}&quot;</span>
    if (isArray) {
      if (!expanded) return <span className="text-slate-400">[{(value as unknown[]).length} items]</span>
      return null
    }
    if (isObject) {
      if (!expanded) {
        const keys = Object.keys(value as object)
        return <span className="text-slate-400">{'{'}{keys.length} keys{'}'}</span>
      }
      return null
    }
    return <span className="text-foreground">{String(value)}</span>
  }

  const entries = isObject
    ? Object.entries(value as Record<string, unknown>)
    : isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : []

  return (
    <div className={cn('font-mono text-xs', depth > 0 && 'ml-4')}>
      <div
        className={cn('flex items-center gap-1 py-0.5', isExpandable && 'cursor-pointer hover:text-foreground')}
        onClick={isExpandable ? () => setExpanded(!expanded) : undefined}
      >
        {isExpandable ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-500" />
          )
        ) : (
          <span className="w-3" />
        )}
        {keyName !== undefined && (
          <>
            <span className="text-indigo-300">{keyName}</span>
            <span className="text-slate-500">: </span>
          </>
        )}
        {renderValue()}
        {isExpandable && !expanded && null}
        {isArray && !expanded && null}
      </div>
      {isExpandable && expanded && (
        <div>
          {entries.map(([k, v]) => (
            <JsonNode key={k} keyName={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  if (data === null || data === undefined) {
    return (
      <div className={cn('rounded-lg bg-background p-3 font-mono text-xs text-slate-500', className)}>
        No data
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg bg-background p-3 overflow-auto', className)}>
      <JsonNode value={data} />
    </div>
  )
}
