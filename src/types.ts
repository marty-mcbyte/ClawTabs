export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Session {
  id: string
  name: string
  messages: Message[]
  isActive: boolean
  isTyping?: boolean
  createdAt: number
}

export interface SystemStatus {
  connected: boolean
  sysStatus: 'NOMINAL' | 'DEGRADED' | 'ERROR'
  memStatus: 'OK' | 'HIGH' | 'CRITICAL'
  netStatus: 'STABLE' | 'UNSTABLE' | 'DOWN'
}
