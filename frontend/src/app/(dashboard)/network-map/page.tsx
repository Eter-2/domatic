'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { networkApi } from '@/lib/api'
import { DeviceDrawer } from '@/components/devices/DeviceDrawer'
import { useDevice } from '@/hooks/useDevices'
import { EmptyState } from '@/components/ui/EmptyState'
import { Network, Wifi, Home, Server, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getProtocolColor } from '@/lib/utils'
import type { NetworkNode, NetworkLink } from '@/types'

// Protocol node colors (raw hex for canvas)
const PROTOCOL_COLORS: Record<string, string> = {
  wifi: '#60a5fa',
  zigbee: '#c084fc',
  zwave: '#fb923c',
  bluetooth: '#22d3ee',
  matter: '#34d399',
  thread: '#f472b6',
  other: '#94a3b8',
}

interface NodePosition {
  x: number
  y: number
  vx: number
  vy: number
  node: NetworkNode
}

function useForceLayout(nodes: NetworkNode[], links: NetworkLink[], width: number, height: number) {
  const [positions, setPositions] = useState<NodePosition[]>([])

  useEffect(() => {
    if (!nodes.length) return

    // Simple force-directed layout simulation
    const pos: NodePosition[] = nodes.map((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      const radius = Math.min(width, height) * 0.3
      return {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        node,
      }
    })

    // Place broker at center
    const brokerIdx = pos.findIndex((p) => p.node.type === 'broker')
    if (brokerIdx >= 0) {
      pos[brokerIdx].x = width / 2
      pos[brokerIdx].y = height / 2
    }

    let frame = 0
    const MAX_FRAMES = 200

    const simulate = () => {
      if (frame++ > MAX_FRAMES) {
        setPositions([...pos])
        return
      }

      const REPULSION = 3000
      const ATTRACTION = 0.05
      const DAMPING = 0.85
      const CENTER_GRAVITY = 0.005

      // Repulsion
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const dx = pos[j].x - pos[i].x
          const dy = pos[j].y - pos[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.001
          const force = REPULSION / (dist * dist)
          pos[i].vx -= (dx / dist) * force
          pos[i].vy -= (dy / dist) * force
          pos[j].vx += (dx / dist) * force
          pos[j].vy += (dy / dist) * force
        }
      }

      // Attraction along links
      links.forEach(({ source, target }) => {
        const srcIdx = pos.findIndex((p) => p.node.id === source)
        const tgtIdx = pos.findIndex((p) => p.node.id === target)
        if (srcIdx < 0 || tgtIdx < 0) return
        const dx = pos[tgtIdx].x - pos[srcIdx].x
        const dy = pos[tgtIdx].y - pos[srcIdx].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const force = dist * ATTRACTION
        pos[srcIdx].vx += (dx / dist) * force
        pos[srcIdx].vy += (dy / dist) * force
        pos[tgtIdx].vx -= (dx / dist) * force
        pos[tgtIdx].vy -= (dy / dist) * force
      })

      // Center gravity + damping + position update
      for (const p of pos) {
        if (p.node.type === 'broker') continue // Keep broker centered
        p.vx += (width / 2 - p.x) * CENTER_GRAVITY
        p.vy += (height / 2 - p.y) * CENTER_GRAVITY
        p.vx *= DAMPING
        p.vy *= DAMPING
        p.x += p.vx
        p.y += p.vy
        p.x = Math.max(30, Math.min(width - 30, p.x))
        p.y = Math.max(30, Math.min(height - 30, p.y))
      }

      if (frame % 20 === 0) setPositions([...pos])
      requestAnimationFrame(simulate)
    }

    requestAnimationFrame(simulate)
  }, [nodes, links, width, height])

  return positions
}

export default function NetworkMapPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 500 })

  const { data: mapData, isLoading, refetch } = useQuery({
    queryKey: ['network-map'],
    queryFn: () => networkApi.getMap(),
    staleTime: 60_000,
  })

  const { data: selectedDevice } = useDevice(selectedDeviceId)

  const nodes = mapData?.nodes ?? []
  const links = mapData?.links ?? []
  const positions = useForceLayout(nodes, links, size.width, size.height)

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Canvas draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || positions.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size.width * zoom
    canvas.height = size.height * zoom
    ctx.scale(zoom, zoom)
    ctx.clearRect(0, 0, size.width, size.height)

    // Draw links
    links.forEach(({ source, target }) => {
      const src = positions.find((p) => p.node.id === source)
      const tgt = positions.find((p) => p.node.id === target)
      if (!src || !tgt) return
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // Draw nodes
    positions.forEach(({ x, y, node }) => {
      const isOnline = node.is_online !== false
      const radius = node.type === 'broker' ? 20 : node.type === 'room' ? 15 : 12
      const color = node.type === 'broker'
        ? '#3b82f6'
        : node.type === 'room'
        ? '#1e40af'
        : (node.protocol ? PROTOCOL_COLORS[node.protocol] ?? '#94a3b8' : '#94a3b8')

      // Glow for online
      if (isOnline && node.type === 'device') {
        ctx.beginPath()
        ctx.arc(x, y, radius + 6, 0, Math.PI * 2)
        const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 6)
        gradient.addColorStop(0, color + '44')
        gradient.addColorStop(1, color + '00')
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isOnline || node.type !== 'device' ? color : '#374151'
      ctx.fill()
      ctx.strokeStyle = isOnline ? color : '#4b5563'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.fillStyle = '#e2e8f0'
      ctx.font = `${node.type === 'broker' ? '600 ' : ''}11px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label, x, y + radius + 14)
    })
  }, [positions, links, zoom, size])

  // Click handler
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / zoom
    const cy = (e.clientY - rect.top) / zoom

    for (const { x, y, node } of positions) {
      const dist = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2)
      if (dist < 20 && node.type === 'device' && node.device_id) {
        setSelectedDeviceId(node.device_id)
        setDrawerOpen(true)
        return
      }
    }
  }, [positions, zoom])

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Network Map</h1>
          <p className="text-sm text-foreground-muted">Visual topology of your IoT network</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-foreground-muted w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'MQTT Broker', color: 'bg-blue-500' },
          { label: 'Room', color: 'bg-blue-800' },
          { label: 'Wi-Fi', color: 'bg-blue-400' },
          { label: 'Zigbee', color: 'bg-purple-400' },
          { label: 'Z-Wave', color: 'bg-orange-400' },
          { label: 'Offline', color: 'bg-slate-600' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            {label}
          </div>
        ))}
        <span className="text-xs text-foreground-dim ml-auto">Click a device node to inspect</span>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="flex-1 rounded-xl border border-border bg-card overflow-hidden"
        style={{ minHeight: 400 }}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-foreground-dim">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p className="text-sm">Building network map…</p>
            </div>
          </div>
        ) : nodes.length === 0 ? (
          <EmptyState
            icon={<Network className="h-8 w-8" />}
            title="No devices to map"
            description="Add devices to see your network topology"
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={size.width}
            height={size.height}
            onClick={handleCanvasClick}
            className="cursor-pointer"
            style={{ width: '100%', height: '100%' }}
            aria-label="Network topology map"
          />
        )}
      </div>

      <DeviceDrawer
        device={selectedDevice ?? null}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
