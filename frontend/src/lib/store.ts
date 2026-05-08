import { create } from 'zustand'
import { generateId } from '@/lib/utils'
import type { MqttMessage, SecurityEvent, AutomationActivity, User } from '@/types'

const MAX_MQTT_MESSAGES = 500

// ─── App Store ────────────────────────────────────────────────────────────────

interface AppStore {
  // WebSocket
  wsConnected: boolean
  wsReconnecting: boolean
  setWsConnected: (connected: boolean) => void
  setWsReconnecting: (reconnecting: boolean) => void

  // Auth
  currentUser: User | null
  setCurrentUser: (user: User | null) => void

  // Alerts
  unreadAlerts: number
  incrementAlerts: () => void
  clearAlerts: () => void

  // MQTT messages (live buffer)
  mqttMessages: MqttMessage[]
  mqttPaused: boolean
  addMqttMessage: (msg: Omit<MqttMessage, 'id'>) => void
  clearMqttMessages: () => void
  toggleMqttPaused: () => void

  // Recent security events (from WS)
  liveSecurityEvents: SecurityEvent[]
  addLiveSecurityEvent: (event: SecurityEvent) => void

  // Automation activity (from WS)
  liveAutomationActivity: AutomationActivity[]
  addAutomationActivity: (activity: AutomationActivity) => void

  // Toast notifications
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

export interface Toast {
  id: string
  title: string
  description?: string
  variant: 'default' | 'success' | 'warning' | 'error'
  duration?: number
}

export const useAppStore = create<AppStore>((set) => ({
  // WebSocket
  wsConnected: false,
  wsReconnecting: false,
  setWsConnected: (connected) => set({ wsConnected: connected, wsReconnecting: false }),
  setWsReconnecting: (reconnecting) => set({ wsReconnecting: reconnecting }),

  // Auth
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // Alerts
  unreadAlerts: 0,
  incrementAlerts: () => set((state) => ({ unreadAlerts: state.unreadAlerts + 1 })),
  clearAlerts: () => set({ unreadAlerts: 0 }),

  // MQTT
  mqttMessages: [],
  mqttPaused: false,
  addMqttMessage: (msg) =>
    set((state) => {
      if (state.mqttPaused) return {}
      const newMsg: MqttMessage = { ...msg, id: generateId() }
      const messages = [newMsg, ...state.mqttMessages].slice(0, MAX_MQTT_MESSAGES)
      return { mqttMessages: messages }
    }),
  clearMqttMessages: () => set({ mqttMessages: [] }),
  toggleMqttPaused: () => set((state) => ({ mqttPaused: !state.mqttPaused })),

  // Live security events
  liveSecurityEvents: [],
  addLiveSecurityEvent: (event) =>
    set((state) => ({
      liveSecurityEvents: [event, ...state.liveSecurityEvents].slice(0, 50),
    })),

  // Automation activity
  liveAutomationActivity: [],
  addAutomationActivity: (activity) =>
    set((state) => ({
      liveAutomationActivity: [activity, ...state.liveAutomationActivity].slice(0, 50),
    })),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: generateId() }],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
