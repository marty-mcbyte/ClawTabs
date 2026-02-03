// Existing types
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  attachments?: Array<{ dataUrl: string; mimeType: string }>
}

export interface Session {
  id: string
  name: string
  messages: Message[]
  isActive: boolean
  isTyping?: boolean
  createdAt: number
  gatewayId?: string // Link to the gateway this session belongs to
}

export interface SystemStatus {
  connected: boolean
  sysStatus: 'NOMINAL' | 'DEGRADED' | 'ERROR'
  memStatus: 'OK' | 'HIGH' | 'CRITICAL'
  netStatus: 'STABLE' | 'UNSTABLE' | 'DOWN'
}

// New multi-gateway types
export type GatewayStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface GatewayConfig {
  id: string
  name: string
  url: string
  token: string
  status: GatewayStatus
  addedAt: number
  lastConnected?: number
  error?: string
}

export interface Agent {
  id: string
  gatewayId: string
  name: string
  status: 'online' | 'offline' | 'busy'
  avatar?: string
  capabilities?: string[]
  lastSeen?: number
}

export interface Channel {
  id: string
  name: string
  description: string
  memberAgentIds: string[]
  createdAt: number
}

export interface ChannelMessage {
  id: string
  channelId: string
  agentId: string
  text: string
  timestamp: number
  attachments?: Array<{ dataUrl: string; mimeType: string }>
}
