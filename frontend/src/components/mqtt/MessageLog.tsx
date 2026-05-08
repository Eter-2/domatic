'use client'

import { useRef, useEffect } from 'react'
import { formatTime, truncate } from '@/lib/utils'
import type { MqttMessage } from '@/types'

interface MessageLogProps {
  messages: MqttMessage[]
  filter?: string
  autoScroll?: boolean
}

export function MessageLog({ messages, filter, autoScroll = true }: MessageLogProps) {
  const endRef = useRef<HTMLDivElement>(null)

  const filtered = filter
    ? messages.filter((m) => m.topic.startsWith(filter))
    : messages

  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, autoScroll])

  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-foreground-dim text-sm font-mono">
        Waiting for messages…
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto font-mono text-xs leading-relaxed">
      {filtered.map((msg) => (
        <div
          key={msg.id}
          className="flex gap-3 border-b border-border/50 px-3 py-1.5 hover:bg-surface transition-colors"
        >
          <span className="flex-shrink-0 text-foreground-dim w-20">{formatTime(msg.timestamp)}</span>
          <span className="flex-shrink-0 text-blue-400 max-w-[200px] truncate" title={msg.topic}>
            {msg.topic}
          </span>
          {msg.retained && (
            <span className="flex-shrink-0 rounded bg-amber-500/10 px-1 text-amber-400 text-[10px]">R</span>
          )}
          <span className="min-w-0 flex-1 truncate text-emerald-300" title={msg.payload}>
            {msg.payload}
          </span>
          <span className="flex-shrink-0 text-foreground-dim">Q{msg.qos}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
