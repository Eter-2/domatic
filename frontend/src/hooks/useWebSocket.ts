'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useQueryClient } from '@tanstack/react-query'
import type { WsEvent, DeviceStateEvent, DeviceOnlineEvent, SecurityAlertEvent, AutomationTriggeredEvent, MqttMessageEvent } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'
const MIN_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000

let globalWs: WebSocket | null = null
let globalReconnectTimer: ReturnType<typeof setTimeout> | null = null
let globalReconnectDelay = MIN_RECONNECT_DELAY
let subscriberCount = 0

export function useWebSocket() {
  const {
    setWsConnected,
    setWsReconnecting,
    addMqttMessage,
    addLiveSecurityEvent,
    addAutomationActivity,
    incrementAlerts,
    addToast,
  } = useAppStore()

  const queryClient = useQueryClient()
  const storeRef = useRef({ setWsConnected, setWsReconnecting, addMqttMessage, addLiveSecurityEvent, addAutomationActivity, incrementAlerts, addToast })
  storeRef.current = { setWsConnected, setWsReconnecting, addMqttMessage, addLiveSecurityEvent, addAutomationActivity, incrementAlerts, addToast }

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsEvent

        switch (msg.type) {
          case 'device_state': {
            const payload = msg.payload as DeviceStateEvent
            queryClient.setQueryData(['devices', payload.device_id], (old: unknown) => {
              if (!old) return old
              return { ...(old as object), state: payload.state, is_online: payload.is_online }
            })
            queryClient.invalidateQueries({ queryKey: ['devices'] })
            break
          }

          case 'device_online':
          case 'device_offline': {
            const payload = msg.payload as DeviceOnlineEvent
            queryClient.invalidateQueries({ queryKey: ['devices'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            break
          }

          case 'security_alert': {
            const payload = msg.payload as SecurityAlertEvent
            storeRef.current.addLiveSecurityEvent(payload.event)
            storeRef.current.incrementAlerts()
            storeRef.current.addToast({
              title: `Security Alert: ${payload.event.severity.toUpperCase()}`,
              description: payload.event.description,
              variant: payload.event.severity === 'critical' || payload.event.severity === 'high' ? 'error' : 'warning',
              duration: 8000,
            })
            queryClient.invalidateQueries({ queryKey: ['security-events'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            break
          }

          case 'automation_triggered': {
            const payload = msg.payload as AutomationTriggeredEvent
            storeRef.current.addAutomationActivity({
              automation_id: payload.automation_id,
              automation_name: payload.automation_name,
              triggered_at: payload.triggered_at,
              success: payload.success,
              result: null,
            })
            queryClient.invalidateQueries({ queryKey: ['automations'] })
            break
          }

          case 'mqtt_message': {
            const payload = msg.payload as MqttMessageEvent
            storeRef.current.addMqttMessage({
              topic: payload.topic,
              payload: payload.payload,
              qos: payload.qos,
              retained: payload.retained,
              timestamp: msg.timestamp,
            })
            break
          }

          case 'ping':
            globalWs?.send(JSON.stringify({ type: 'pong' }))
            break

          default:
            break
        }
      } catch {
        // Non-JSON or unknown message — ignore silently
      }
    },
    [queryClient]
  )

  const connect = useCallback(() => {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) return
    if (globalWs && globalWs.readyState === WebSocket.CONNECTING) return

    try {
      globalWs = new WebSocket(WS_URL)

      globalWs.onopen = () => {
        storeRef.current.setWsConnected(true)
        globalReconnectDelay = MIN_RECONNECT_DELAY
      }

      globalWs.onclose = () => {
        storeRef.current.setWsConnected(false)
        storeRef.current.setWsReconnecting(true)
        globalWs = null
        scheduleReconnect()
      }

      globalWs.onerror = () => {
        storeRef.current.setWsConnected(false)
      }

      globalWs.onmessage = handleMessage
    } catch {
      scheduleReconnect()
    }
  }, [handleMessage])

  const scheduleReconnect = () => {
    if (globalReconnectTimer) return
    globalReconnectTimer = setTimeout(() => {
      globalReconnectTimer = null
      globalReconnectDelay = Math.min(globalReconnectDelay * 2, MAX_RECONNECT_DELAY)
      connect()
    }, globalReconnectDelay)
  }

  useEffect(() => {
    subscriberCount++
    connect()

    return () => {
      subscriberCount--
      if (subscriberCount === 0) {
        if (globalReconnectTimer) {
          clearTimeout(globalReconnectTimer)
          globalReconnectTimer = null
        }
        globalWs?.close()
        globalWs = null
      }
    }
  }, [connect])

  const sendMessage = useCallback((data: unknown) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(data))
    }
  }, [])

  return { sendMessage }
}
