import { useState, useCallback, useEffect, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { SplitView } from './components/SplitView'
import { TopBar } from './components/TopBar'
import { BottomBar } from './components/BottomBar'
import { OpsPanel } from './components/OpsPanel'
import { LandingPage } from './components/LandingPage'
import { CommandPalette } from './components/CommandPalette'
import { GatewaySettings } from './components/GatewaySettings'
import { AgentSidebar } from './components/AgentSidebar'
import { ChannelSidebar } from './components/ChannelSidebar'
import { ChannelPanel } from './components/ChannelPanel'
import { ChannelModal } from './components/ChannelModal'
import { StatsBar } from './components/StatsBar'
import { LiveFeed } from './components/LiveFeed'
import { TaskModal } from './components/TaskModal'
import { KanbanBoard } from './components/KanbanBoard'
import { MissionControl } from './components/MissionControl'
import type { Session, Message, SystemStatus, GatewayConfig, Channel, ChannelMessage, ActivityEvent, Task } from './types'
import { Gateway } from './gateway'
import type { ConnectionStatus } from './gateway'
import { getGatewayManager } from './store/GatewayManager'
import { 
  generateId as generateDbId, 
  deleteGateway,
  getAllChannels,
  saveChannel,
  deleteChannel as deleteChannelDb,
  getMessagesByChannel,
  saveMessage as saveChannelMessage,
  getAllTasks,
  saveTask,
  deleteTask as deleteTaskDb
} from './store/db'
import './App.css'

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

// LocalStorage helpers for session names (gateway doesn't persist displayName)
const SESSION_NAMES_KEY = 'clawtabs-session-names'

function loadSessionNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SESSION_NAMES_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveSessionName(id: string, name: string) {
  const names = loadSessionNames()
  names[id] = name
  localStorage.setItem(SESSION_NAMES_KEY, JSON.stringify(names))
}

function getSessionName(id: string, fallback: string): string {
  const names = loadSessionNames()
  return names[id] || fallback
}

function extractContent(raw: any): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    return raw.filter((c: any) => c.type === 'text').map((c: any) => c.text ?? '').join('')
  }
  return String(raw ?? '')
}

const OPS_PATTERNS = [/subagent/i, /sub-agent/i, /isolated/i, /cron/i, /heartbeat/i, /background/i, /worker/i, /spawned/i]

function isOpsSession(session: { id: string; name: string }): boolean {
  return OPS_PATTERNS.some(p => p.test(session.name) || p.test(session.id))
}

function getConfigFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const hasExplicitGateway = params.has('gateway') || params.has('token')
  
  let url = params.get('gateway') || `ws://${window.location.hostname}:18789`
  
  // Upgrade ws:// to wss:// when page is served over HTTPS (browsers block mixed content)
  if (window.location.protocol === 'https:' && url.startsWith('ws://')) {
    url = 'wss://' + url.slice(5)
  }
  
  return {
    token: params.get('token') || 'eae9203476a753ae79acfb39e0e85fbc81ff667a3e667bb4',
    url,
    hasExplicitGateway,
  }
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'ops'>('chat')
  const [searchQuery, setSearchQuery] = useState('')
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected')
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [showLanding, setShowLanding] = useState(false)
  // Split view state
  const [isSplit, setIsSplit] = useState(() => {
    try { return localStorage.getItem('clawtabs-split') === 'true' } catch { return false }
  })
  const [splitRightSessionId, setSplitRightSessionId] = useState(() => {
    try { return localStorage.getItem('clawtabs-split-right') || '' } catch { return '' }
  })
  const [splitRatio, setSplitRatio] = useState(() => {
    try { return parseFloat(localStorage.getItem('clawtabs-split-ratio') || '0.5') || 0.5 } catch { return 0.5 }
  })
  const failCountRef = useRef(0)
  const gwRef = useRef<Gateway | null>(null)
  // Track streaming content per session
  const streamingRef = useRef<Map<string, { msgId: string; content: string }>>(new Map())
  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  // Gateway settings state
  const [gatewaySettingsOpen, setGatewaySettingsOpen] = useState(false)
  const [gatewayConfigs, setGatewayConfigs] = useState<GatewayConfig[]>([])
  const gatewayManagerRef = useRef(getGatewayManager())
  // Agent filter state (null = show all)
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(null)
  
  // Channel state
  const [viewMode, setViewMode] = useState<'sessions' | 'channels' | 'tasks' | 'mission'>('sessions')
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [channelMessages, setChannelMessages] = useState<Map<string, ChannelMessage[]>>(new Map())
  const [channelModalOpen, setChannelModalOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  // Track pending channel context per gateway (for routing responses back)
  const channelContextRef = useRef<Map<string, { channelId: string; timestamp: number }>>(new Map())
  // Track which agents are currently typing in channels
  const [channelTypingAgents, setChannelTypingAgents] = useState<Map<string, Set<string>>>(new Map())
  // Track unread counts per channel (messages since last viewed)
  const [channelUnreadCounts, setChannelUnreadCounts] = useState<Map<string, number>>(new Map())
  // Track last read timestamp per channel
  const channelLastReadRef = useRef<Map<string, number>>(new Map())
  // Ref to track current active channel (for unread tracking in event handlers)
  const activeChannelIdRef = useRef<string | null>(null)
  // Track if browser notifications are enabled
  const notificationsEnabledRef = useRef(false)
  // Refs for notification data (to avoid stale closures)
  const gatewayConfigsRef = useRef<GatewayConfig[]>([])
  const channelsRef = useRef<Channel[]>([])
  
  // Activity feed state
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [showLiveFeed, setShowLiveFeed] = useState(true)
  const MAX_ACTIVITY_EVENTS = 100
  
  // Task state
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  // Track which task is active per agent (agentId -> taskId) - for auto-updating status on lifecycle events
  const activeTaskByAgentRef = useRef<Map<string, string>>(new Map())
  // Ref to access current tasks in event handlers (avoids stale closures)
  const tasksRef = useRef<Task[]>([])
  
  // Helper to add activity event (using ref for stable reference in event handlers)
  const addActivityEventRef = useRef<(event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void>(() => {})
  addActivityEventRef.current = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    const fullEvent: ActivityEvent = {
      ...event,
      id: generateId(),
      timestamp: Date.now()
    }
    setActivityEvents(prev => {
      const updated = [fullEvent, ...prev]
      // Keep only last N events
      return updated.slice(0, MAX_ACTIVITY_EVENTS)
    })
  }
  
  // Keep refs in sync
  useEffect(() => { gatewayConfigsRef.current = gatewayConfigs }, [gatewayConfigs])
  useEffect(() => { channelsRef.current = channels }, [channels])
  useEffect(() => { tasksRef.current = tasks }, [tasks])
  
  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        notificationsEnabledRef.current = true
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          notificationsEnabledRef.current = permission === 'granted'
        })
      }
    }
  }, [])

  const status: SystemStatus = {
    connected: connStatus === 'connected',
    sysStatus: connStatus === 'connected' ? 'NOMINAL' : connStatus === 'connecting' ? 'DEGRADED' : 'ERROR',
    memStatus: 'OK',
    netStatus: connStatus === 'connected' ? 'STABLE' : connStatus === 'connecting' ? 'UNSTABLE' : 'DOWN'
  }

  // Persist split state
  useEffect(() => {
    try {
      localStorage.setItem('clawtabs-split', String(isSplit))
      localStorage.setItem('clawtabs-split-right', splitRightSessionId)
      localStorage.setItem('clawtabs-split-ratio', String(splitRatio))
    } catch {}
  }, [isSplit, splitRightSessionId, splitRatio])

  // Sync active channel ref and clear unreads when switching channels
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId
    if (activeChannelId) {
      // Clear unread for this channel
      setChannelUnreadCounts(prev => {
        if (!prev.has(activeChannelId)) return prev
        const next = new Map(prev)
        next.delete(activeChannelId)
        return next
      })
      // Update last read timestamp
      channelLastReadRef.current.set(activeChannelId, Date.now())
    }
  }, [activeChannelId])

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]
  const splitRightSession = sessions.find(s => s.id === splitRightSessionId)

  // Initialize gateway manager and load stored gateways
  useEffect(() => {
    const manager = gatewayManagerRef.current
    const { url, token, hasExplicitGateway } = getConfigFromUrl()

    // Parse task status updates from agent messages
    // Patterns: [TASK #abc123 STATUS:in_progress], [TASK #abc123 COMPLETE], [TASK #abc123 DONE]
    const parseTaskStatusUpdate = (text: string): { taskIdSuffix: string; newStatus: Task['status'] } | null => {
      // Match patterns like [TASK #abc123 STATUS:in_progress] or [TASK #abc123 COMPLETE]
      const statusMatch = text.match(/\[TASK #([a-z0-9]+)\s+STATUS:(\w+)\]/i)
      if (statusMatch) {
        const statusMap: Record<string, Task['status']> = {
          'inbox': 'inbox',
          'assigned': 'assigned',
          'in_progress': 'in_progress',
          'active': 'in_progress',
          'review': 'review',
          'done': 'done',
          'complete': 'done',
          'completed': 'done'
        }
        const status = statusMap[statusMatch[2].toLowerCase()]
        if (status) {
          return { taskIdSuffix: statusMatch[1], newStatus: status }
        }
      }
      
      // Match shorthand patterns like [TASK #abc123 COMPLETE] or [TASK #abc123 DONE]
      const shortMatch = text.match(/\[TASK #([a-z0-9]+)\s+(COMPLETE|DONE|ACTIVE|REVIEW)\]/i)
      if (shortMatch) {
        const shortStatusMap: Record<string, Task['status']> = {
          'complete': 'done',
          'done': 'done',
          'active': 'in_progress',
          'review': 'review'
        }
        const status = shortStatusMap[shortMatch[2].toLowerCase()]
        if (status) {
          return { taskIdSuffix: shortMatch[1], newStatus: status }
        }
      }
      
      return null
    }

    // Handler for chat events from any gateway
    const handleChatEvent = (payload: any, eventType: string, gatewayId?: string) => {
      const sessionKey = payload?.sessionKey
      if (!sessionKey) return

      // Helper to route response to channel if context exists
      const routeToChannelIfNeeded = (text: string, agentId: string) => {
        const ctx = channelContextRef.current.get(agentId)
        if (ctx && Date.now() - ctx.timestamp < 5 * 60 * 1000) { // 5 min timeout
          // Create channel message from agent response
          const channelMsg: ChannelMessage = {
            id: generateDbId(),
            channelId: ctx.channelId,
            agentId: agentId,
            text: text,
            timestamp: Date.now()
          }
          // Save and add to state
          saveChannelMessage(channelMsg).catch(console.error)
          setChannelMessages(prev => {
            const next = new Map(prev)
            const existing = next.get(ctx.channelId) || []
            next.set(ctx.channelId, [...existing, channelMsg])
            return next
          })
          
          // Increment unread if not viewing this channel
          if (activeChannelIdRef.current !== ctx.channelId) {
            setChannelUnreadCounts(prev => {
              const next = new Map(prev)
              next.set(ctx.channelId, (prev.get(ctx.channelId) || 0) + 1)
              return next
            })
            
            // Send browser notification if window not focused
            if (notificationsEnabledRef.current && document.hidden) {
              const agentName = gatewayConfigsRef.current.find(g => g.id === agentId)?.name || 'Agent'
              const channelName = channelsRef.current.find(c => c.id === ctx.channelId)?.name || 'channel'
              new Notification(`#${channelName}`, {
                body: `${agentName}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
                icon: '/favicon.png',
                tag: `channel-${ctx.channelId}` // Replace previous notification from same channel
              })
            }
          }
          
          // Clear context after response
          channelContextRef.current.delete(agentId)
          return true
        }
        return false
      }

      // Use agent events for streaming (they have delta text)
      if (eventType === 'agent') {
        const stream = payload?.stream
        const data = payload?.data

        // Lifecycle events
        if (stream === 'lifecycle') {
          if (data?.phase === 'start') {
            setCurrentRunId(payload?.runId ?? null)
            setSessions(prev => prev.map(s =>
              s.id === sessionKey ? { ...s, isTyping: true } : s
            ))
            // Track channel typing if there's a channel context
            if (gatewayId) {
              const ctx = channelContextRef.current.get(gatewayId)
              if (ctx) {
                setChannelTypingAgents(prev => {
                  const next = new Map(prev)
                  const agents = next.get(ctx.channelId) || new Set()
                  agents.add(gatewayId)
                  next.set(ctx.channelId, agents)
                  return next
                })
              }
              
              // Auto-update task to in_progress when agent starts working
              const activeTaskId = activeTaskByAgentRef.current.get(gatewayId)
              if (activeTaskId) {
                const task = tasksRef.current.find(t => t.id === activeTaskId)
                // Move to in_progress if task is inbox or assigned (not already in_progress/review/done)
                if (task && (task.status === 'inbox' || task.status === 'assigned')) {
                  const updatedTask = { ...task, status: 'in_progress' as const, updatedAt: Date.now() }
                  saveTask(updatedTask).catch(console.error)
                  setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t))
                  
                  // Log activity
                  const agentName = gatewayConfigsRef.current.find(g => g.id === gatewayId)?.name || 'Agent'
                  addActivityEventRef.current({
                    agentId: gatewayId,
                    agentName,
                    type: 'task_update',
                    summary: `Started: ${task.title}`,
                    source: sessionKey
                  })
                  console.log('[ClawTabs] Task auto-updated to in_progress:', task.title)
                }
              }
            }
          } else if (data?.phase === 'end') {
            streamingRef.current.delete(sessionKey)
            setSessions(prev => prev.map(s =>
              s.id === sessionKey ? { ...s, isTyping: false } : s
            ))
            setCurrentRunId(null)
            // Clear channel typing
            if (gatewayId) {
              setChannelTypingAgents(prev => {
                const next = new Map(prev)
                for (const [channelId, agents] of next) {
                  agents.delete(gatewayId)
                  if (agents.size === 0) next.delete(channelId)
                  else next.set(channelId, agents)
                }
                return next
              })
            }
          }
          return
        }

        // Capture activity for error events
        if (stream === 'error' && gatewayId) {
          const agentName = gatewayConfigsRef.current.find(g => g.id === gatewayId)?.name || 'Agent'
          addActivityEventRef.current({
            agentId: gatewayId,
            agentName,
            type: 'error',
            summary: data?.message || 'An error occurred',
            source: sessionKey
          })
        }

        // Assistant text streaming
        if (stream === 'assistant' && data?.text) {
          const fullText = data.text
          const existing = streamingRef.current.get(sessionKey)
          if (existing) {
            existing.content = fullText
            const msgId = existing.msgId
            setSessions(prev => prev.map(s => {
              if (s.id !== sessionKey) return s
              return {
                ...s,
                messages: s.messages.map(m =>
                  m.id === msgId ? { ...m, content: fullText } : m
                )
              }
            }))
          } else {
            const msgId = generateId()
            streamingRef.current.set(sessionKey, { msgId, content: fullText })
            const msg: Message = {
              id: msgId,
              role: 'assistant',
              content: fullText,
              timestamp: Date.now()
            }
            setSessions(prev => prev.map(s =>
              s.id === sessionKey
                ? { ...s, messages: [...s.messages, msg] }
                : s
            ))
          }
        }
        return
      }

      // Chat events — use 'final' state to ensure we have complete message
      if (eventType === 'chat' && payload?.state === 'final') {
        const content = payload?.message?.content
        if (Array.isArray(content)) {
          const text = content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
          
          // Add activity event for message
          if (gatewayId && text) {
            const agentName = gatewayConfigsRef.current.find(g => g.id === gatewayId)?.name || 'Agent'
            const ctx = channelContextRef.current.get(gatewayId)
            const channelName = ctx ? channelsRef.current.find(c => c.id === ctx.channelId)?.name : undefined
            
            addActivityEventRef.current({
              agentId: gatewayId,
              agentName,
              type: 'message',
              summary: channelName ? `Replied in #${channelName}` : `Responded in ${sessionKey.split(':').pop() || 'session'}`,
              details: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
              source: channelName ? `#${channelName}` : sessionKey
            })
            
            // Check for task status updates in agent messages
            const taskUpdate = parseTaskStatusUpdate(text)
            if (taskUpdate) {
              console.log('[ClawTabs] Task status update detected:', taskUpdate)
              // Find the task by ID suffix
              setTasks(prev => {
                const task = prev.find(t => t.id.endsWith(taskUpdate.taskIdSuffix))
                if (task && task.status !== taskUpdate.newStatus) {
                  const updatedTask = { ...task, status: taskUpdate.newStatus, updatedAt: Date.now() }
                  // Persist to IndexedDB
                  saveTask(updatedTask).catch(console.error)
                  // Log activity
                  addActivityEventRef.current({
                    agentId: gatewayId,
                    agentName,
                    type: 'task_update',
                    summary: `Task "${task.title}" → ${taskUpdate.newStatus.replace('_', ' ').toUpperCase()}`,
                    source: sessionKey
                  })
                  console.log('[ClawTabs] Task updated:', task.title, '→', taskUpdate.newStatus)
                  return prev.map(t => t.id === task.id ? updatedTask : t)
                }
                return prev
              })
            }
          }
          
          // Check if this should be routed to a channel
          if (gatewayId && routeToChannelIfNeeded(text, gatewayId)) {
            // Response was routed to channel, also update session for completeness
          }
          
          const existing = streamingRef.current.get(sessionKey)
          if (existing) {
            // Update the streaming message with final content
            const msgId = existing.msgId
            setSessions(prev => prev.map(s => {
              if (s.id !== sessionKey) return s
              return {
                ...s,
                messages: s.messages.map(m =>
                  m.id === msgId ? { ...m, content: text } : m
                )
              }
            }))
            streamingRef.current.delete(sessionKey)
          }
        }
      }
    }

    // Listen to gateway manager events
    const unsubscribe = manager.addListener((event) => {
      if (event.type === 'statusChange') {
        // Update gateway configs state
        setGatewayConfigs([...manager.getConfigs()])
        
        // Update overall connection status based on first connected gateway
        const firstConnected = manager.getFirstConnected()
        if (firstConnected) {
          setConnStatus('connected')
          failCountRef.current = 0
          setShowLanding(false)
        } else if (manager.getConfigs().some(c => c.status === 'connecting')) {
          setConnStatus('connecting')
        } else {
          setConnStatus('disconnected')
        }

        // Also set gwRef for backward compatibility
        if (firstConnected) {
          gwRef.current = firstConnected.gateway
        }
      } else if (event.type === 'chatEvent') {
        handleChatEvent(event.payload, event.payload.eventType, event.gatewayId)
      } else if (event.type === 'gatewayAdded' || event.type === 'gatewayRemoved') {
        setGatewayConfigs([...manager.getConfigs()])
      }
    })

    // Initialize the manager and load stored gateways
    manager.initialize().then(async (storedGateways) => {
      setGatewayConfigs(storedGateways)

      // If URL params provided a gateway, add it if not already stored
      if (hasExplicitGateway) {
        const existingByUrl = storedGateways.find(g => g.url === url)
        if (!existingByUrl) {
          // Add the URL param gateway
          const parsedUrl = new URL(url)
          const existingCount = storedGateways.length
          // Generate a friendly name: "Agent 1", "Agent 2", etc. or use hostname:port if non-standard
          const friendlyName = parsedUrl.port && parsedUrl.port !== '18789' 
            ? `Agent (${parsedUrl.hostname}:${parsedUrl.port})`
            : `Agent ${existingCount + 1}`
          const newConfig: GatewayConfig = {
            id: generateDbId(),
            name: friendlyName,
            url,
            token,
            status: 'disconnected',
            addedAt: Date.now()
          }
          await manager.addGateway(newConfig, true)
        } else {
          // Connect to existing gateway with matching URL
          await manager.connect(existingByUrl.id)
        }
      } else if (storedGateways.length > 0) {
        // Connect to all stored gateways
        await manager.connectAll()
      } else {
        // No gateways and no URL params - show landing
        setShowLanding(true)
      }
    }).catch((err) => {
      console.error('[ClawTabs] Failed to initialize gateway manager:', err)
      setShowLanding(true)
    })

    return () => {
      unsubscribe()
      manager.disconnectAll()
    }
  }, [])

  // Load channels from IndexedDB on mount
  useEffect(() => {
    getAllChannels().then(storedChannels => {
      setChannels(storedChannels)
      // Load messages for each channel
      for (const channel of storedChannels) {
        getMessagesByChannel(channel.id).then(msgs => {
          setChannelMessages(prev => new Map(prev).set(channel.id, msgs))
        })
      }
    }).catch(err => {
      console.error('[ClawTabs] Failed to load channels:', err)
    })
  }, [])

  // Load tasks from IndexedDB on mount
  useEffect(() => {
    getAllTasks().then(storedTasks => {
      setTasks(storedTasks)
    }).catch(err => {
      console.error('[ClawTabs] Failed to load tasks:', err)
    })
  }, [])

  // Load sessions from ALL connected gateways
  useEffect(() => {
    if (connStatus !== 'connected') return
    const manager = gatewayManagerRef.current

    manager.listSessions().then(async (results) => {
      console.log('[GW] listSessions from all gateways:', results.length, 'sessions')
      if (results.length === 0) {
        // No sessions from any gateway — create a local placeholder
        const firstConnected = manager.getFirstConnected()
        const fallback: Session = {
          id: 'general',
          name: 'General',
          messages: [],
          isActive: true,
          createdAt: Date.now(),
          gatewayId: firstConnected?.config.id
        }
        setSessions([fallback])
        setActiveSessionId('general')
        return
      }

      const loaded: Session[] = results.map(({ session: rs, gatewayId }) => {
        const id = rs.key ?? rs.sessionKey ?? rs.id ?? generateId()
        const defaultName = rs.displayName ?? rs.name ?? rs.label ?? rs.title ?? rs.key ?? 'Session'
        return {
          id,
          name: getSessionName(id, defaultName),
          messages: [],
          isActive: true,
          createdAt: rs.createdAt ?? rs.created ?? Date.now(),
          gatewayId // Track which gateway owns this session
        }
      })

      setSessions(loaded)
      setActiveSessionId(loaded[0].id)

      // Load history for all sessions (from their respective gateways)
      for (const sess of loaded) {
        if (!sess.gatewayId) continue
        try {
          const history = await manager.chatHistory(sess.id, sess.gatewayId)
          console.log('[GW] chat.history for', sess.id, ':', JSON.stringify(history).substring(0, 500))
          if (Array.isArray(history) && history.length > 0) {
            const msgs: Message[] = history.map((m: any) => ({
              id: m.id ?? generateId(),
              role: m.role ?? 'assistant',
              content: extractContent(m.content) || m.text || '',
              timestamp: m.timestamp ?? m.ts ?? Date.now()
            }))
            setSessions(prev => prev.map(s =>
              s.id === sess.id ? { ...s, messages: msgs } : s
            ))
          }
        } catch (e) {
          console.error('[GW] Failed to load history for', sess.id, e)
        }
      }
    }).catch((err) => {
      console.error('[GW] listSessions failed:', err)
      const fallback: Session = {
        id: 'general', name: 'General', messages: [], isActive: true, createdAt: Date.now()
      }
      setSessions([fallback])
      setActiveSessionId('general')
    })
  }, [connStatus])

  // Load history when switching sessions (uses session's gatewayId)
  const loadHistory = useCallback(async (sessionId: string) => {
    if (connStatus !== 'connected') return
    const manager = gatewayManagerRef.current
    
    // Find the session to get its gatewayId
    const session = sessions.find(s => s.id === sessionId)
    const gatewayId = session?.gatewayId
    
    if (!gatewayId) {
      // Fallback to first connected gateway
      const firstConnected = manager.getFirstConnected()
      if (!firstConnected) return
      try {
        const history = await manager.chatHistory(sessionId, firstConnected.config.id)
        if (Array.isArray(history) && history.length > 0) {
          const msgs: Message[] = history.map((m: any) => ({
            id: m.id ?? generateId(),
            role: m.role ?? 'assistant',
            content: extractContent(m.content) || m.text || '',
            timestamp: m.timestamp ?? m.ts ?? Date.now()
          }))
          setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, messages: msgs } : s
          ))
        }
      } catch {}
      return
    }
    
    try {
      const history = await manager.chatHistory(sessionId, gatewayId)
      if (Array.isArray(history) && history.length > 0) {
        const msgs: Message[] = history.map((m: any) => ({
          id: m.id ?? generateId(),
          role: m.role ?? 'assistant',
          content: extractContent(m.content) || m.text || '',
          timestamp: m.timestamp ?? m.ts ?? Date.now()
        }))
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, messages: msgs } : s
        ))
      }
    } catch (e) {
      console.error('[GW] loadHistory failed:', e)
    }
  }, [connStatus, sessions])

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    // Load history if messages empty
    const sess = sessions.find(s => s.id === id)
    if (sess && sess.messages.length === 0) {
      loadHistory(id)
    }
  }, [sessions, loadHistory])

  const createSession = useCallback(() => {
    const manager = gatewayManagerRef.current
    
    // Use selected gateway if filtered, otherwise first connected
    let targetGatewayId: string | undefined
    if (selectedGatewayId) {
      const selectedGw = manager.getConfig(selectedGatewayId)
      if (selectedGw?.status === 'connected') {
        targetGatewayId = selectedGatewayId
      }
    }
    if (!targetGatewayId) {
      const firstConnected = manager.getFirstConnected()
      targetGatewayId = firstConnected?.config.id
    }
    
    const shortId = generateId()
    const sessionKey = `agent:main:${shortId}`
    const newSession: Session = {
      id: sessionKey,
      name: `Transmission ${sessions.length + 1}`,
      messages: [],
      isActive: true,
      createdAt: Date.now(),
      gatewayId: targetGatewayId
    }
    setSessions(prev => [...prev, newSession])
    setActiveSessionId(newSession.id)
  }, [sessions.length, selectedGatewayId])

  const closeSession = useCallback((id: string) => {
    // Find session to get gatewayId before removing
    const session = sessions.find(s => s.id === id)
    const gatewayId = session?.gatewayId
    
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id)
      if (filtered.length === 0) {
        const manager = gatewayManagerRef.current
        const firstConnected = manager.getFirstConnected()
        const fallback: Session = {
          id: generateId(), name: 'General', messages: [], isActive: true, createdAt: Date.now(),
          gatewayId: firstConnected?.config.id
        }
        setActiveSessionId(fallback.id)
        return [fallback]
      }
      if (activeSessionId === id) {
        setActiveSessionId(filtered[filtered.length - 1].id)
      }
      return filtered
    })
    // Delete from the correct gateway
    if (gatewayId) {
      gatewayManagerRef.current.deleteSession(id, gatewayId).catch(() => {})
    }
  }, [activeSessionId, sessions])

  const renameSession = useCallback((id: string, name: string) => {
    const session = sessions.find(s => s.id === id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    saveSessionName(id, name) // Persist to localStorage
    // Rename via the correct gateway
    if (session?.gatewayId) {
      gatewayManagerRef.current.renameSession(id, name, session.gatewayId).catch(() => {})
    }
  }, [sessions])

  const addMessage = useCallback((sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, message] }
        : s
    ))
  }, [])

  const setTyping = useCallback((sessionId: string, typing: boolean) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, isTyping: typing } : s
    ))
  }, [])

  const getPreview = (session: Session): string => {
    if (session.messages.length === 0) return 'No messages yet'
    const last = session.messages[session.messages.length - 1]
    return last.content.substring(0, 60) + (last.content.length > 60 ? '...' : '')
  }

  const getTimeAgo = (ts: number): string => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  // Filter sessions by gateway if selected
  const gatewayFilteredSessions = selectedGatewayId
    ? sessions.filter(s => s.gatewayId === selectedGatewayId)
    : sessions

  const chatSessions = gatewayFilteredSessions.filter(s => !isOpsSession(s))
  const opsSessions = gatewayFilteredSessions.filter(s => isOpsSession(s))

  const visibleSessions = activeTab === 'chat' ? chatSessions : opsSessions

  const filteredSessions = searchQuery
    ? visibleSessions.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : visibleSessions

  const { url: gatewayUrl } = getConfigFromUrl()

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Command palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
        return
      }
      // Don't process other shortcuts if command palette is open
      if (commandPaletteOpen) return
      
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        createSession()
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        closeSession(activeSessionId)
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        const idx = sessions.findIndex(s => s.id === activeSessionId)
        const next = e.shiftKey
          ? (idx - 1 + sessions.length) % sessions.length
          : (idx + 1) % sessions.length
        setActiveSessionId(sessions[next].id)
      }
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        if (idx < sessions.length) {
          setActiveSessionId(sessions[idx].id)
        }
      }
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault()
        toggleSplit()
      }
      // Ctrl+T - Create task
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        setTaskModalOpen(true)
      }
      // Ctrl+M - Toggle Mission Control
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        setViewMode(v => v === 'mission' ? 'sessions' : 'mission')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sessions, activeSessionId, createSession, closeSession, commandPaletteOpen])

  const toggleSplit = useCallback(() => {
    setIsSplit(prev => {
      if (!prev) {
        // Opening split — pick a second session
        const other = sessions.find(s => s.id !== activeSessionId)
        if (other) setSplitRightSessionId(other.id)
        else return false // can't split with only one session
      }
      return !prev
    })
  }, [sessions, activeSessionId])

  const handleSendMessageForSession = useCallback((sessionId: string, text: string, attachments?: any[]) => {
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      ...(attachments?.length ? { attachments } : {})
    }
    addMessage(sessionId, userMsg)
    setTyping(sessionId, true)

    const manager = gatewayManagerRef.current
    if (connStatus !== 'connected') {
      addMessage(sessionId, { id: generateId(), role: 'system', content: '⚠ Not connected to any OpenClaw gateway.', timestamp: Date.now() })
      setTyping(sessionId, false)
      return
    }

    // Find the session's gateway
    const session = sessions.find(s => s.id === sessionId)
    const gatewayId = session?.gatewayId

    manager.chatSend(sessionId, text, attachments, gatewayId)
      .then((ack: any) => { if (ack?.runId) setCurrentRunId(ack.runId) })
      .catch((err: any) => {
        const errMsg = typeof err === 'string' ? err : (err?.message || err?.error || JSON.stringify(err))
        console.error('[ClawTabs] chat.send failed:', err)
        addMessage(sessionId, { id: generateId(), role: 'system', content: `⚠ Failed to send message to gateway: ${errMsg}`, timestamp: Date.now() })
        setTyping(sessionId, false)
      })
  }, [addMessage, setTyping, connStatus, sessions])

  const handleSendMessage = useCallback((text: string, attachments?: any[]) => {
    if (!activeSession) return
    handleSendMessageForSession(activeSession.id, text, attachments)
  }, [activeSession, handleSendMessageForSession])

  const handleAbortForSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    const gatewayId = session?.gatewayId
    if (!gatewayId) return
    
    gatewayManagerRef.current.chatAbort(sessionId, gatewayId, currentRunId ?? undefined).catch(() => {})
    setTyping(sessionId, false)
    streamingRef.current.delete(sessionId)
    setCurrentRunId(null)
  }, [currentRunId, setTyping, sessions])

  const handleAbort = useCallback(() => {
    if (!activeSession) return
    handleAbortForSession(activeSession.id)
  }, [activeSession, handleAbortForSession])

  // Gateway settings handlers
  const handleAddGateway = useCallback(async (config: GatewayConfig) => {
    const manager = gatewayManagerRef.current
    await manager.addGateway(config, true)
    setGatewayConfigs([...manager.getConfigs()])
  }, [])

  const handleRemoveGateway = useCallback(async (id: string) => {
    const manager = gatewayManagerRef.current
    await manager.removeGateway(id)
    await deleteGateway(id)
    setGatewayConfigs([...manager.getConfigs()])
  }, [])

  const handleConnectGateway = useCallback(async (id: string) => {
    const manager = gatewayManagerRef.current
    await manager.connect(id)
    setGatewayConfigs([...manager.getConfigs()])
  }, [])

  const handleDisconnectGateway = useCallback(async (id: string) => {
    const manager = gatewayManagerRef.current
    await manager.disconnect(id)
    setGatewayConfigs([...manager.getConfigs()])
  }, [])

  const handleTestConnection = useCallback(async (url: string, token: string) => {
    const manager = gatewayManagerRef.current
    return manager.testConnection(url, token)
  }, [])

  const handleRenameGateway = useCallback(async (id: string, name: string) => {
    const manager = gatewayManagerRef.current
    await manager.updateGateway(id, { name })
    setGatewayConfigs([...manager.getConfigs()])
  }, [])

  const handleUpdateGateway = useCallback(async (id: string, updates: Partial<GatewayConfig>) => {
    const manager = gatewayManagerRef.current
    await manager.updateGateway(id, updates)
    setGatewayConfigs([...manager.getConfigs()])
  }, [])

  // Channel handlers
  const handleCreateChannel = useCallback(async (channel: Channel) => {
    await saveChannel(channel)
    setChannels(prev => [...prev, channel])
    setChannelMessages(prev => new Map(prev).set(channel.id, []))
    setActiveChannelId(channel.id)
    setViewMode('channels')
  }, [])

  const handleUpdateChannel = useCallback(async (channel: Channel) => {
    await saveChannel(channel)
    setChannels(prev => prev.map(c => c.id === channel.id ? channel : c))
  }, [])

  const handleDeleteChannel = useCallback(async (id: string) => {
    await deleteChannelDb(id)
    setChannels(prev => prev.filter(c => c.id !== id))
    setChannelMessages(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    if (activeChannelId === id) {
      setActiveChannelId(null)
    }
  }, [activeChannelId])

  const handleSendChannelMessage = useCallback(async (channelId: string, text: string, targetAgentId?: string) => {
    const channel = channels.find(c => c.id === channelId)
    if (!channel) return

    const manager = gatewayManagerRef.current
    
    // Determine which agent(s) to send to
    const targetAgents = targetAgentId 
      ? [targetAgentId] 
      : channel.memberAgentIds

    // Create the user's message first (only once, not per agent)
    const userMsg: ChannelMessage = {
      id: generateDbId(),
      channelId,
      agentId: 'user',
      text: text,
      timestamp: Date.now()
    }
    
    await saveChannelMessage(userMsg)
    setChannelMessages(prev => {
      const next = new Map(prev)
      const existing = next.get(channelId) || []
      next.set(channelId, [...existing, userMsg])
      return next
    })

    // For each target agent, send the message to their gateway
    for (const agentId of targetAgents) {
      const gateway = manager.getGateway(agentId)
      if (!gateway || gateway.status !== 'connected') continue

      // Register channel context for this agent so responses get routed back
      channelContextRef.current.set(agentId, {
        channelId,
        timestamp: Date.now()
      })

      // Send to the gateway with channel context
      const agentName = gatewayConfigs.find(g => g.id === agentId)?.name || 'Agent'
      const channelContext = `[Channel: #${channel.name}] ${targetAgentId ? `@${agentName}: ` : ''}${text}`
      
      try {
        await gateway.chatSend('agent:main', channelContext)
      } catch (err) {
        console.error(`[ClawTabs] Failed to send to ${agentId}:`, err)
        // Clear context on failure
        channelContextRef.current.delete(agentId)
      }
    }
  }, [channels, gatewayConfigs])

  // Task handlers
  const handleCreateTask = useCallback(async (task: Task) => {
    await saveTask(task)
    setTasks(prev => [task, ...prev])
    
    // Add activity event
    addActivityEventRef.current({
      agentId: task.assignedAgentId || 'system',
      agentName: task.assignedAgentId 
        ? gatewayConfigs.find(g => g.id === task.assignedAgentId)?.name || 'Agent'
        : 'System',
      type: 'task_start',
      summary: `Task created: ${task.title}`,
      details: task.description,
      source: task.source?.name
    })
    
    // If task is assigned to an agent, notify them
    if (task.assignedAgentId) {
      const manager = gatewayManagerRef.current
      const gateway = manager.getGateway(task.assignedAgentId)
      const agentName = gatewayConfigs.find(g => g.id === task.assignedAgentId)?.name || 'Agent'
      
      if (gateway?.status === 'connected') {
        // Find the best session to send to:
        // 1. If user is currently viewing a session for this agent, use that
        // 2. Otherwise, use agent:main (the primary session)
        // 3. Fall back to first available session for this agent
        const currentSession = sessions.find(s => s.id === activeSessionId)
        const agentSessions = sessions.filter(s => s.gatewayId === task.assignedAgentId)
        
        let targetSessionId: string
        if (currentSession?.gatewayId === task.assignedAgentId) {
          // User is viewing a session for this agent - use it
          targetSessionId = activeSessionId
        } else {
          // Find agent:main or first session
          const mainSession = agentSessions.find(s => s.id === 'agent:main')
          targetSessionId = mainSession?.id || agentSessions[0]?.id || 'agent:main'
        }
        
        // Track this task as active for the agent
        activeTaskByAgentRef.current.set(task.assignedAgentId, task.id)
        
        // Build task message with clear instructions
        const taskId = task.id.slice(-6)
        const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'
        const taskMessage = `📋 **New Task Assigned**

**Task:** ${task.title}
**ID:** #${taskId}
**Priority:** ${priorityEmoji} ${task.priority || 'medium'}
${task.tags?.length ? `**Tags:** ${task.tags.join(', ')}` : ''}

${task.description || ''}

---
Update status with:
• \`[TASK #${taskId} ACTIVE]\` — when you start
• \`[TASK #${taskId} DONE]\` — when complete
• \`[TASK #${taskId} REVIEW]\` — if needs review

Or I can drag the card manually in Kanban.`
        
        console.log('[ClawTabs] Task dispatch → session:', targetSessionId, 'agent:', agentName)
        
        try {
          await gateway.chatSend(targetSessionId, taskMessage)
          console.log('[ClawTabs] Task sent successfully')
          
          // Switch view to that session so user sees the conversation
          if (activeSessionId !== targetSessionId) {
            setActiveSessionId(targetSessionId)
          }
          setViewMode('sessions')
          
          // Add success event to live feed
          addActivityEventRef.current({
            agentId: task.assignedAgentId,
            agentName,
            type: 'task_start',
            summary: `Task dispatched to ${agentName}`,
            details: `Sent to session: ${targetSessionId}`,
            source: 'Task System'
          })
        } catch (err) {
          console.error('[ClawTabs] Failed to send task:', err)
          activeTaskByAgentRef.current.delete(task.assignedAgentId)
          
          // Add error event
          addActivityEventRef.current({
            agentId: task.assignedAgentId,
            agentName,
            type: 'error',
            summary: `Failed to dispatch task to ${agentName}`,
            details: String(err),
            source: 'Task System'
          })
        }
      } else {
        console.warn('[ClawTabs] Task dispatch skipped - agent not connected')
        addActivityEventRef.current({
          agentId: task.assignedAgentId,
          agentName,
          type: 'error',
          summary: `Cannot dispatch task - ${agentName} is offline`,
          source: 'Task System'
        })
      }
    }
  }, [gatewayConfigs, sessions, activeSessionId])

  const handleUpdateTask = useCallback(async (task: Task) => {
    // Get previous state to detect status transitions
    const prevTask = tasks.find(t => t.id === task.id)
    
    await saveTask(task)
    setTasks(prev => prev.map(t => t.id === task.id ? task : t))
    
    // Dispatch to agent if task just moved to 'assigned' status with an agent
    const wasJustAssigned = task.status === 'assigned' && 
      task.assignedAgentId && 
      (prevTask?.status !== 'assigned' || prevTask?.assignedAgentId !== task.assignedAgentId)
    
    // Dispatch to agent when task moves to 'assigned' column (drag-drop or edit)
    if (wasJustAssigned) {
      const manager = gatewayManagerRef.current
      const gateway = manager.getGateway(task.assignedAgentId!)
      const agentName = gatewayConfigs.find(g => g.id === task.assignedAgentId)?.name || 'Agent'
      
      if (gateway?.status === 'connected') {
        // Find best session (same logic as create)
        const currentSession = sessions.find(s => s.id === activeSessionId)
        const agentSessions = sessions.filter(s => s.gatewayId === task.assignedAgentId)
        
        let targetSessionId: string
        if (currentSession?.gatewayId === task.assignedAgentId) {
          targetSessionId = activeSessionId
        } else {
          const mainSession = agentSessions.find(s => s.id === 'agent:main')
          targetSessionId = mainSession?.id || agentSessions[0]?.id || 'agent:main'
        }
        
        activeTaskByAgentRef.current.set(task.assignedAgentId!, task.id)
        
        const taskId = task.id.slice(-6)
        const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'
        const taskMessage = `📋 **Task Assigned to You**

**Task:** ${task.title}
**ID:** #${taskId}
**Priority:** ${priorityEmoji} ${task.priority || 'medium'}

${task.description || ''}

---
Update: \`[TASK #${taskId} ACTIVE]\` / \`[TASK #${taskId} DONE]\``
        
        try {
          await gateway.chatSend(targetSessionId, taskMessage)
          addActivityEventRef.current({
            agentId: task.assignedAgentId!,
            agentName,
            type: 'task_start',
            summary: `Task assigned: ${task.title}`,
            details: `Sent to ${targetSessionId}`,
            source: 'Task System'
          })
        } catch (err) {
          console.error('[ClawTabs] Failed to send task:', err)
          activeTaskByAgentRef.current.delete(task.assignedAgentId!)
        }
      }
    }
    
    // Clear task tracking when task moves to done or is unassigned
    if (task.status === 'done' || !task.assignedAgentId) {
      if (prevTask?.assignedAgentId) {
        activeTaskByAgentRef.current.delete(prevTask.assignedAgentId)
        console.log('[ClawTabs] Task tracking cleared for agent:', prevTask.assignedAgentId)
      }
    }
  }, [tasks, gatewayConfigs, sessions, activeSessionId])

  const handleDeleteTask = useCallback(async (id: string) => {
    await deleteTaskDb(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleImportTasks = useCallback(async (importedTasks: Task[]) => {
    // Merge imported tasks - update existing, add new
    for (const task of importedTasks) {
      await saveTask(task)
    }
    // Reload all tasks
    const allTasks = await getAllTasks()
    setTasks(allTasks)
  }, [])

  const activeChannel = channels.find(c => c.id === activeChannelId)
  const activeChannelMessages = activeChannelId ? (channelMessages.get(activeChannelId) || []) : []

  if (showLanding) {
    return <LandingPage />
  }

  if (sessions.length === 0) {
    // Still loading
    return (
      <div className="app">
        <div className="scanline" />
        <TopBar 
          status={status} 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          gatewayCount={gatewayConfigs.length}
          connectedGatewayCount={gatewayConfigs.filter(g => g.status === 'connected').length}
          onOpenGatewaySettings={() => setGatewaySettingsOpen(true)}
        />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          {connStatus === 'connecting' ? 'Connecting to gateway...' : connStatus === 'disconnected' ? 'Disconnected — retrying...' : 'Loading sessions...'}
        </div>
        <BottomBar sessionCount={0} />
        <GatewaySettings
          isOpen={gatewaySettingsOpen}
          onClose={() => setGatewaySettingsOpen(false)}
          gateways={gatewayConfigs}
          onAddGateway={handleAddGateway}
          onRemoveGateway={handleRemoveGateway}
          onConnect={handleConnectGateway}
          onDisconnect={handleDisconnectGateway}
          onTestConnection={handleTestConnection}
          onRenameGateway={handleRenameGateway}
          onUpdateGateway={handleUpdateGateway}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="scanline" />
      <TopBar
        status={status}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        chatCount={chatSessions.length}
        opsCount={opsSessions.length}
        isSplit={isSplit}
        onToggleSplit={toggleSplit}
        gatewayCount={gatewayConfigs.length}
        connectedGatewayCount={gatewayConfigs.filter(g => g.status === 'connected').length}
        onOpenGatewaySettings={() => setGatewaySettingsOpen(true)}
      />
      <StatsBar
        activeAgentCount={gatewayConfigs.filter(g => g.status === 'connected').length}
        totalAgentCount={gatewayConfigs.length}
        taskCount={tasks.filter(t => t.status !== 'done').length}
        sessionCount={sessions.length}
        showFeed={showLiveFeed}
        onToggleFeed={() => setShowLiveFeed(prev => !prev)}
        onCreateTask={() => setTaskModalOpen(true)}
      />
      <div className="main-content">
        {activeTab === 'ops' ? (
          <OpsPanel
            sessions={opsSessions}
            allSessions={sessions}
            connStatus={connStatus}
            gatewayUrl={gatewayUrl}
            onSelectSession={(id) => {
              setActiveTab('chat')
              selectSession(id)
            }}
          />
        ) : viewMode === 'mission' ? (
          <MissionControl
            tasks={tasks}
            gateways={gatewayConfigs}
            events={activityEvents}
            onUpdateTask={handleUpdateTask}
            onEditTask={(task) => { setEditingTask(task); setTaskModalOpen(true) }}
            onCreateTask={() => setTaskModalOpen(true)}
            onSelectAgent={setSelectedGatewayId}
            selectedAgentId={selectedGatewayId}
            onImportTasks={handleImportTasks}
          />
        ) : viewMode === 'channels' ? (
          <>
            {/* Channel View */}
            <ChannelSidebar
              channels={channels}
              activeChannelId={activeChannelId}
              gateways={gatewayConfigs}
              unreadCounts={channelUnreadCounts}
              onSelect={setActiveChannelId}
              onCreate={() => setChannelModalOpen(true)}
              onDelete={handleDeleteChannel}
              onBackToSessions={() => setViewMode('sessions')}
            />
            {activeChannel ? (
              <ChannelPanel
                channel={activeChannel}
                messages={activeChannelMessages}
                gateways={gatewayConfigs}
                typingAgentIds={Array.from(channelTypingAgents.get(activeChannel.id) || [])}
                onSendMessage={handleSendChannelMessage}
                onRename={(name) => handleUpdateChannel({ ...activeChannel, name })}
                onEditMembers={() => { setEditingChannel(activeChannel); setChannelModalOpen(true) }}
              />
            ) : (
              <div className="channel-placeholder">
                <div className="channel-placeholder-icon">#</div>
                <div className="channel-placeholder-title">Select a channel</div>
                <div className="channel-placeholder-desc">
                  Choose a channel from the sidebar or create a new one to start coordinating your agents.
                </div>
                <button 
                  className="channel-placeholder-btn"
                  onClick={() => setChannelModalOpen(true)}
                >
                  + Create Channel
                </button>
              </div>
            )}
          </>
        ) : viewMode === 'tasks' ? (
          <>
            {/* Tasks View - Kanban Board */}
            <KanbanBoard
              tasks={tasks}
              gateways={gatewayConfigs}
              onUpdateTask={handleUpdateTask}
              onEditTask={(task) => { setEditingTask(task); setTaskModalOpen(true) }}
              onCreateTask={() => setTaskModalOpen(true)}
            />
            {/* Live Feed - right panel */}
            {showLiveFeed && (
              <LiveFeed
                events={activityEvents}
                gateways={gatewayConfigs}
                onJumpToSource={(event) => {
                  const session = sessions.find(s => s.id === event.source || s.id.includes(event.source || ''))
                  if (session) {
                    setViewMode('sessions')
                    selectSession(session.id)
                  }
                }}
              />
            )}
          </>
        ) : (
          <>
            {/* Session View */}
            {/* Agent sidebar - show when multiple gateways configured */}
            {gatewayConfigs.length > 1 && (
              <AgentSidebar
                gateways={gatewayConfigs}
                sessions={sessions}
                selectedGatewayId={selectedGatewayId}
                onSelectGateway={setSelectedGatewayId}
                onOpenSettings={() => setGatewaySettingsOpen(true)}
              />
            )}
            <Sidebar
              sessions={filteredSessions}
              activeSessionId={activeSessionId}
              onSelect={selectSession}
              onCreate={createSession}
              onClose={closeSession}
              onRename={renameSession}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              getPreview={getPreview}
              getTimeAgo={getTimeAgo}
              sessionCount={filteredSessions.length}
              splitSessionId={isSplit ? splitRightSessionId : undefined}
              gateways={gatewayConfigs}
            />
            {isSplit && splitRightSession ? (
              <SplitView
                leftSession={activeSession}
                rightSession={splitRightSession}
                allSessions={chatSessions}
                onSendMessage={handleSendMessageForSession}
                onRename={renameSession}
                onAbort={handleAbortForSession}
                onSelectRight={(id) => { setSplitRightSessionId(id); loadHistory(id) }}
                onCloseSplit={() => setIsSplit(false)}
                splitRatio={splitRatio}
                onSplitRatioChange={setSplitRatio}
              />
            ) : (
              <ChatPanel
                session={activeSession}
                onSendMessage={handleSendMessage}
                onRename={(name) => renameSession(activeSession.id, name)}
                onAbort={activeSession?.isTyping ? handleAbort : undefined}
              />
            )}
            {/* Live Feed - right panel */}
            {showLiveFeed && (
              <LiveFeed
                events={activityEvents}
                gateways={gatewayConfigs}
                onJumpToSource={(event) => {
                  // Try to jump to the session
                  const session = sessions.find(s => s.id === event.source || s.id.includes(event.source || ''))
                  if (session) {
                    selectSession(session.id)
                  }
                }}
              />
            )}
          </>
        )}
      </div>
      <BottomBar 
        sessionCount={sessions.length} 
        channelCount={channels.length}
        taskCount={tasks.filter(t => t.status !== 'done').length}
        totalUnread={Array.from(channelUnreadCounts.values()).reduce((a, b) => a + b, 0)}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onCreateSession={createSession}
        onCloseSession={closeSession}
        onToggleSplit={toggleSplit}
        isSplit={isSplit}
      />
      <GatewaySettings
        isOpen={gatewaySettingsOpen}
        onClose={() => setGatewaySettingsOpen(false)}
        gateways={gatewayConfigs}
        onAddGateway={handleAddGateway}
        onRemoveGateway={handleRemoveGateway}
        onConnect={handleConnectGateway}
        onDisconnect={handleDisconnectGateway}
        onTestConnection={handleTestConnection}
        onRenameGateway={handleRenameGateway}
        onUpdateGateway={handleUpdateGateway}
      />
      <ChannelModal
        isOpen={channelModalOpen}
        onClose={() => { setChannelModalOpen(false); setEditingChannel(null) }}
        gateways={gatewayConfigs}
        onCreateChannel={handleCreateChannel}
        editingChannel={editingChannel}
        onUpdateChannel={handleUpdateChannel}
      />
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditingTask(null) }}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        editingTask={editingTask}
        gateways={gatewayConfigs}
      />
    </div>
  )
}

export default App
