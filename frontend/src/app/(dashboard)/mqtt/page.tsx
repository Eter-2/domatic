'use client'

import { useState } from 'react'
import { Terminal, Pause, Play, Trash2, Filter } from 'lucide-react'
import { useMqttMessages, useMqttTopicStats } from '@/hooks/useMqttMessages'
import { MessageLog } from '@/components/mqtt/MessageLog'
import { PublishForm } from '@/components/mqtt/PublishForm'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export default function MqttPage() {
  const { messages, paused, clear, togglePause } = useMqttMessages()
  const { data: topicStats = [] } = useMqttTopicStats()
  const [topicFilter, setTopicFilter] = useState('')

  const topTop10 = topicStats.slice(0, 10)

  return (
    <div className="flex flex-col gap-5 animate-fade-in h-full">
      <div>
        <h1 className="text-xl font-bold text-foreground">MQTT Console</h1>
        <p className="text-sm text-foreground-muted">Live broker messages and publish interface</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: message log */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Controls */}
          <div className="flex items-center gap-3">
            <Input
              placeholder="Filter by topic prefix…"
              leftAddon={<Filter className="h-3.5 w-3.5" />}
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Button
              size="sm"
              variant={paused ? 'primary' : 'secondary'}
              leftIcon={paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              onClick={togglePause}
              aria-label={paused ? 'Resume messages' : 'Pause messages'}
            >
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={clear}
              aria-label="Clear messages"
            >
              Clear
            </Button>
            <span className="text-xs text-foreground-dim">{messages.length} msgs</span>
          </div>

          {/* Log */}
          <div className="rounded-xl border border-border bg-card overflow-hidden flex-1" style={{ minHeight: 420 }}>
            {/* Header bar */}
            <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
              <Terminal className="h-3.5 w-3.5 text-foreground-dim" />
              <span className="font-mono text-xs text-foreground-dim">
                TIME &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; TOPIC &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PAYLOAD &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; QOS
              </span>
              {paused && (
                <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  PAUSED
                </span>
              )}
            </div>
            <div style={{ height: 380 }}>
              <MessageLog messages={messages} filter={topicFilter || undefined} />
            </div>
          </div>
        </div>

        {/* Right: publish + chart */}
        <div className="space-y-4">
          {/* Publish form */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Publish Message</h2>
            <PublishForm />
          </div>

          {/* Topic frequency chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Top Topics</h2>
            {topTop10.length === 0 ? (
              <p className="py-4 text-center text-xs text-foreground-dim">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topTop10} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="topic"
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                    tickFormatter={(v) => v.length > 12 ? v.slice(0, 10) + '…' : v}
                  />
                  <Tooltip
                    contentStyle={{ background: '#131d2e', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
