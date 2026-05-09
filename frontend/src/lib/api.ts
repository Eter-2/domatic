import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import type {
  Device,
  Room,
  SecurityEvent,
  Automation,
  FirmwareUpdate,
  DashboardSummary,
  NetworkMapResponse,
  TokenResponse,
  SetupResponse,
  LoginCredentials,
  SetupCredentials,
  User,
  PaginatedResponse,
  DeviceFormData,
  RoomFormData,
  CommandFormData,
  MqttMessage,
  AutomationActivity,
} from '@/types'

// ─── Token management (in-memory + localStorage for refresh) ─────────────────

let accessToken: string | null = null
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setRefreshToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) {
    localStorage.setItem('refresh_token', token)
  } else {
    localStorage.removeItem('refresh_token')
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('refresh_token')
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
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
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

      const storedRefreshToken = getRefreshToken()
      if (!storedRefreshToken) {
        isRefreshing = false
        accessToken = null
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post<TokenResponse>(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1'}/auth/refresh`,
          { refresh_token: storedRefreshToken }
        )
        accessToken = data.access_token
        setRefreshToken(data.refresh_token)
        onRefreshed(data.access_token)
        isRefreshing = false
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(originalRequest)
      } catch {
        isRefreshing = false
        accessToken = null
        setRefreshToken(null)
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
    apiClient.post<TokenResponse>('/auth/login', credentials).then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken }).then((r) => r.data),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),

  setup: (data: Omit<SetupCredentials, 'confirm_password'>) =>
    apiClient.post<SetupResponse>('/auth/setup', data).then((r) => r.data),

  checkSetup: () =>
    apiClient.get<{ setup_required: boolean }>('/auth/setup/status').then((r) => r.data),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getSummary: () =>
    apiClient.get<DashboardSummary>('/dashboard/summary').then((r) => r.data),

  getNetworkMap: () =>
    apiClient.get<NetworkMapResponse>('/dashboard/network-map').then((r) => r.data),
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export interface DeviceFilters {
  room_id?: string
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

  getById: (id: string) =>
    apiClient.get<Device>(`/devices/${id}`).then((r) => r.data),

  create: (data: DeviceFormData) =>
    apiClient.post<Device>('/devices', data).then((r) => r.data),

  update: (id: string, data: Partial<DeviceFormData>) =>
    apiClient.put<Device>(`/devices/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/devices/${id}`).then((r) => r.data),

  sendCommand: (id: string, data: { topic: string; payload: string; qos?: number }) =>
    apiClient.post(`/devices/${id}/command`, data).then((r) => r.data),

  getHistory: (id: string, hours?: number) =>
    apiClient.get(`/devices/${id}/history`, { params: { hours } }).then((r) => r.data),
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const roomsApi = {
  getAll: () =>
    apiClient.get<Room[]>('/rooms').then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Room>(`/rooms/${id}`).then((r) => r.data),

  create: (data: RoomFormData) =>
    apiClient.post<Room>('/rooms', data).then((r) => r.data),

  update: (id: string, data: Partial<RoomFormData>) =>
    apiClient.put<Room>(`/rooms/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/rooms/${id}`).then((r) => r.data),
}

// ─── Security ─────────────────────────────────────────────────────────────────

export interface SecurityFilters {
  severity?: string
  resolved?: boolean
  device_id?: string
  page?: number
  size?: number
}

export const securityApi = {
  getEvents: (filters?: SecurityFilters) =>
    apiClient.get<PaginatedResponse<SecurityEvent>>('/security/events', { params: filters }).then((r) => r.data),

  resolve: (id: string) =>
    apiClient.post<SecurityEvent>(`/security/events/${id}/resolve`).then((r) => r.data),

  getStats: () =>
    apiClient.get<Record<string, number>>('/security/stats').then((r) => r.data),
}

// ─── Automations ──────────────────────────────────────────────────────────────

export const automationsApi = {
  getAll: () =>
    apiClient.get<Automation[]>('/automations').then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Automation>(`/automations/${id}`).then((r) => r.data),

  create: (data: Partial<Automation>) =>
    apiClient.post<Automation>('/automations', data).then((r) => r.data),

  update: (id: string, data: Partial<Automation>) =>
    apiClient.put<Automation>(`/automations/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/automations/${id}`).then((r) => r.data),

  toggle: (id: string, enabled: boolean) =>
    apiClient.post<Automation>(`/automations/${id}/toggle`, { enabled }).then((r) => r.data),

  test: (id: string) =>
    apiClient.post<{ success: boolean; result: string }>(`/automations/${id}/test`).then((r) => r.data),

  getActivity: (): Promise<AutomationActivity[]> =>
    Promise.resolve([]),
}

// ─── MQTT ─────────────────────────────────────────────────────────────────────

export const mqttApi = {
  getMessages: (limit?: number, topic?: string) =>
    apiClient.get<MqttMessage[]>('/mqtt/messages', { params: { limit, topic } }).then((r) => r.data),

  publish: (topic: string, payload: string, qos?: number) =>
    apiClient.post('/mqtt/publish', { topic, payload, qos }).then((r) => r.data),
}

// ─── Firmware ─────────────────────────────────────────────────────────────────

export const firmwareApi = {
  getCandidates: () =>
    apiClient.get<Device[]>('/firmware/candidates').then((r) => r.data),

  logUpdate: (deviceId: string, data: { to_firmware: string; firmware_type: string; notes?: string | null }) =>
    apiClient.post<FirmwareUpdate>(`/firmware/${deviceId}/log-update`, data).then((r) => r.data),

  getHistory: (deviceId: string) =>
    apiClient.get<FirmwareUpdate[]>(`/firmware/${deviceId}/history`).then((r) => r.data),
}

// ─── Network Map ──────────────────────────────────────────────────────────────

export const networkApi = {
  getMap: () => dashboardApi.getNetworkMap(),
}
