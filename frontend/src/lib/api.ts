import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import type {
  Device,
  Room,
  SecurityEvent,
  Automation,
  FirmwareUpdate,
  DashboardSummary,
  NetworkMapResponse,
  AuthResponse,
  LoginCredentials,
  SetupCredentials,
  User,
  PaginatedResponse,
  DeviceFormData,
  RoomFormData,
  CommandFormData,
  FirmwareLogFormData,
  MqttMessage,
  AutomationActivity,
} from '@/types'

// ─── Token management (in-memory) ────────────────────────────────────────────

let accessToken: string | null = null
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // for HttpOnly cookie refresh token
})

// Request interceptor — add Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — 401 → refresh → retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post<AuthResponse>(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        accessToken = data.access_token
        onRefreshed(data.access_token)
        isRefreshing = false
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(originalRequest)
      } catch {
        isRefreshing = false
        accessToken = null
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export { apiClient }

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<AuthResponse>('/auth/login', credentials).then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then((r) => r.data),

  refresh: () =>
    apiClient.post<AuthResponse>('/auth/refresh').then((r) => r.data),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),

  setup: (data: SetupCredentials) =>
    apiClient.post<AuthResponse>('/auth/setup', data).then((r) => r.data),

  checkSetup: () =>
    apiClient.get<{ setup_required: boolean }>('/auth/setup/status').then((r) => r.data),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getSummary: () =>
    apiClient.get<DashboardSummary>('/dashboard/summary').then((r) => r.data),
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export interface DeviceFilters {
  room_id?: number
  protocol?: string
  firmware_type?: string
  is_online?: boolean
  search?: string
  page?: number
  size?: number
}

export const devicesApi = {
  getAll: (filters?: DeviceFilters) =>
    apiClient.get<PaginatedResponse<Device>>('/devices', { params: filters }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<Device>(`/devices/${id}`).then((r) => r.data),

  create: (data: DeviceFormData) =>
    apiClient.post<Device>('/devices', data).then((r) => r.data),

  update: (id: number, data: Partial<DeviceFormData>) =>
    apiClient.put<Device>(`/devices/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/devices/${id}`).then((r) => r.data),

  sendCommand: (id: number, data: CommandFormData) =>
    apiClient.post(`/devices/${id}/command`, data).then((r) => r.data),

  getHistory: (id: number, hours?: number) =>
    apiClient.get(`/devices/${id}/history`, { params: { hours } }).then((r) => r.data),
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const roomsApi = {
  getAll: () =>
    apiClient.get<Room[]>('/rooms').then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<Room>(`/rooms/${id}`).then((r) => r.data),

  create: (data: RoomFormData) =>
    apiClient.post<Room>('/rooms', data).then((r) => r.data),

  update: (id: number, data: Partial<RoomFormData>) =>
    apiClient.put<Room>(`/rooms/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/rooms/${id}`).then((r) => r.data),
}

// ─── Security ─────────────────────────────────────────────────────────────────

export interface SecurityFilters {
  severity?: string
  resolved?: boolean
  device_id?: number
  page?: number
  size?: number
}

export const securityApi = {
  getEvents: (filters?: SecurityFilters) =>
    apiClient.get<PaginatedResponse<SecurityEvent>>('/security/events', { params: filters }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<SecurityEvent>(`/security/events/${id}`).then((r) => r.data),

  resolve: (id: number) =>
    apiClient.post<SecurityEvent>(`/security/events/${id}/resolve`).then((r) => r.data),

  getStats: () =>
    apiClient.get<Record<string, number>>('/security/stats').then((r) => r.data),
}

// ─── Automations ──────────────────────────────────────────────────────────────

export const automationsApi = {
  getAll: () =>
    apiClient.get<Automation[]>('/automations').then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<Automation>(`/automations/${id}`).then((r) => r.data),

  create: (data: Partial<Automation>) =>
    apiClient.post<Automation>('/automations', data).then((r) => r.data),

  update: (id: number, data: Partial<Automation>) =>
    apiClient.put<Automation>(`/automations/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/automations/${id}`).then((r) => r.data),

  toggle: (id: number, enabled: boolean) =>
    apiClient.patch<Automation>(`/automations/${id}/toggle`, { enabled }).then((r) => r.data),

  test: (id: number) =>
    apiClient.post<{ success: boolean; result: string }>(`/automations/${id}/test`).then((r) => r.data),

  getActivity: () =>
    apiClient.get<AutomationActivity[]>('/automations/activity').then((r) => r.data),
}

// ─── MQTT ─────────────────────────────────────────────────────────────────────

export const mqttApi = {
  getHistory: (limit?: number, topic?: string) =>
    apiClient.get<MqttMessage[]>('/mqtt/history', { params: { limit, topic } }).then((r) => r.data),

  publish: (topic: string, payload: string, qos?: number) =>
    apiClient.post('/mqtt/publish', { topic, payload, qos }).then((r) => r.data),

  getTopicStats: () =>
    apiClient.get<{ topic: string; count: number }[]>('/mqtt/stats/topics').then((r) => r.data),
}

// ─── Firmware ─────────────────────────────────────────────────────────────────

export const firmwareApi = {
  getHistory: (deviceId?: number) =>
    apiClient.get<FirmwareUpdate[]>('/firmware/history', { params: { device_id: deviceId } }).then((r) => r.data),

  logUpdate: (data: FirmwareLogFormData) =>
    apiClient.post<FirmwareUpdate>('/firmware/log', data).then((r) => r.data),

  getDevicesNeedingAttention: () =>
    apiClient.get<Device[]>('/firmware/needs-attention').then((r) => r.data),
}

// ─── Network Map ──────────────────────────────────────────────────────────────

export const networkApi = {
  getMap: () =>
    apiClient.get<NetworkMapResponse>('/network/map').then((r) => r.data),
}
