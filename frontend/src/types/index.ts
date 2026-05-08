// ─── Enums ───────────────────────────────────────────────────────────────────

export type Protocol = 'wifi' | 'zigbee' | 'zwave' | 'bluetooth' | 'matter' | 'thread' | 'other'
export type FirmwareType = 'tasmota' | 'esphome' | 'original' | 'unknown' | 'custom'
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AutomationTriggerType = 'state_change' | 'schedule' | 'mqtt' | 'webhook' | 'manual'
export type QoSLevel = 0 | 1 | 2
export type ChipType = 'esp8266' | 'esp32' | 'esp32s2' | 'esp32s3' | 'esp32c3' | 'nrf52' | 'other'

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Room {
  id: number
  name: string
  description: string | null
  icon: string | null
  device_count: number
  online_count: number
  created_at: string
  updated_at: string
}

export interface Device {
  id: number
  name: string
  room_id: number | null
  room?: Room
  protocol: Protocol
  firmware_type: FirmwareType
  chip_type: ChipType | null
  ip_address: string | null
  mac_address: string | null
  mqtt_topic: string | null
  is_online: boolean
  last_seen: string | null
  state: Record<string, unknown>
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SecurityEvent {
  id: number
  device_id: number | null
  device?: Device
  event_type: string
  severity: SecuritySeverity
  description: string
  source_ip: string | null
  destination_ip: string | null
  raw_data: Record<string, unknown> | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export interface AutomationTrigger {
  type: AutomationTriggerType
  device_id?: number
  state_key?: string
  state_value?: unknown
  schedule?: string // cron expression
  mqtt_topic?: string
  mqtt_payload?: string
}

export interface AutomationCondition {
  type: 'state' | 'time' | 'schedule'
  device_id?: number
  state_key?: string
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
  value?: unknown
  from?: string
  to?: string
}

export interface AutomationAction {
  type: 'mqtt_publish' | 'device_command' | 'notify' | 'webhook'
  device_id?: number
  topic?: string
  payload?: string | Record<string, unknown>
  qos?: QoSLevel
  url?: string
  message?: string
}

export interface Automation {
  id: number
  name: string
  description: string | null
  enabled: boolean
  trigger: AutomationTrigger
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  last_triggered: string | null
  trigger_count: number
  created_at: string
  updated_at: string
}

export interface FirmwareUpdate {
  id: number
  device_id: number
  device?: Device
  from_firmware: string | null
  to_firmware: string
  firmware_type: FirmwareType
  notes: string | null
  performed_by: string | null
  created_at: string
}

export interface MqttMessage {
  id: string // client-side uuid
  topic: string
  payload: string
  qos: QoSLevel
  retained: boolean
  timestamp: string
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'user' | 'readonly'
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SetupCredentials {
  name: string
  email: string
  password: string
  confirm_password: string
}

// ─── Dashboard / Summary ──────────────────────────────────────────────────────

export interface DashboardSummary {
  total_devices: number
  online_devices: number
  offline_devices: number
  active_automations: number
  unresolved_security_events: number
  rooms: Room[]
  recent_security_events: SecurityEvent[]
  recent_mqtt_messages: MqttMessage[]
  recent_automation_activity: AutomationActivity[]
}

export interface AutomationActivity {
  automation_id: number
  automation_name: string
  triggered_at: string
  success: boolean
  result: string | null
}

// ─── Network Map ──────────────────────────────────────────────────────────────

export interface NetworkNode {
  id: string
  type: 'device' | 'room' | 'broker'
  label: string
  protocol?: Protocol
  is_online?: boolean
  device_id?: number
  room_id?: number
}

export interface NetworkLink {
  source: string
  target: string
  type: 'device_room' | 'device_broker' | 'room_broker'
}

export interface NetworkMapResponse {
  nodes: NetworkNode[]
  links: NetworkLink[]
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ApiError {
  detail: string
  code?: string
}

// ─── WebSocket event types ────────────────────────────────────────────────────

export type WsEventType =
  | 'device_state'
  | 'device_online'
  | 'device_offline'
  | 'security_alert'
  | 'automation_triggered'
  | 'mqtt_message'
  | 'ping'
  | 'pong'

export interface WsEvent<T = unknown> {
  type: WsEventType
  payload: T
  timestamp: string
}

export interface DeviceStateEvent {
  device_id: number
  state: Record<string, unknown>
  is_online: boolean
}

export interface DeviceOnlineEvent {
  device_id: number
  is_online: boolean
  last_seen: string
}

export interface SecurityAlertEvent {
  event: SecurityEvent
}

export interface AutomationTriggeredEvent {
  automation_id: number
  automation_name: string
  triggered_at: string
  success: boolean
}

export interface MqttMessageEvent {
  topic: string
  payload: string
  qos: QoSLevel
  retained: boolean
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface DeviceFormData {
  name: string
  room_id: number | null
  protocol: Protocol
  firmware_type: FirmwareType
  chip_type: ChipType | null
  ip_address: string | null
  mac_address: string | null
  mqtt_topic: string | null
}

export interface RoomFormData {
  name: string
  description: string | null
  icon: string | null
}

export interface CommandFormData {
  topic: string
  payload: string
  qos: QoSLevel
}

export interface FirmwareLogFormData {
  device_id: number
  to_firmware: string
  firmware_type: FirmwareType
  notes: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface SelectOption<T = string> {
  label: string
  value: T
}
