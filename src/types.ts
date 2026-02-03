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
export type WorkingStatus = 'working' | 'standby' | 'busy' | 'offline'

export interface GatewayConfig {
  id: string
  name: string
  url: string
  token: string
  status: GatewayStatus
  addedAt: number
  lastConnected?: number
  error?: string
  // Agent profile fields
  role?: string              // "Dev", "Research", "Content", "Finance"
  description?: string       // "Handles code reviews and PRs"
  avatar?: string            // Emoji or URL
  capabilities?: string[]    // ["code", "research", "write"]
  // Working status (inferred from activity)
  workingStatus?: WorkingStatus
  currentTask?: string       // "Processing PR review..."
  lastActivity?: number      // Timestamp of last activity
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

// Activity & Task types (for Live Feed and Mission Control)
export type ActivityEventType = 'message' | 'task_complete' | 'task_start' | 'error' | 'status_change'

export interface ActivityEvent {
  id: string
  timestamp: number
  agentId: string
  agentName: string
  type: ActivityEventType
  summary: string           // "Replied to #coordination"
  details?: string          // Full message preview
  source?: string           // Channel name, session name
}

export type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  assignedAgentId?: string
  createdAt: number
  updatedAt: number
  source?: {
    type: 'channel' | 'session' | 'manual'
    id: string
    name: string
  }
  tags?: string[]
  priority?: TaskPriority
}
