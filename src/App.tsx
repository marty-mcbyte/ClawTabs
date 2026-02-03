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
import type { Session, Message, SystemStatus, GatewayConfig, Channel, ChannelMessage } from './types'
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
  saveMessage as saveChannelMessage
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
  const [viewMode, setViewMode] = useState<'sessions' | 'channels'>('sessions')
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [channelMessages, setChannelMessages] = useState<Map<string, ChannelMessage[]>>(new Map())
  const [channelModalOpen, setChannelModalOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)

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

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]
  const splitRightSession = sessions.find(s => s.id === splitRightSessionId)

  // Initialize gateway manager and load stored gateways
  useEffect(() => {
    const manager = gatewayManagerRef.current
    const { url, token, hasExplicitGateway } = getConfigFromUrl()

    // Handler for chat events from any gateway
    const handleChatEvent = (payload: any, eventType: string) => {
      const sessionKey = payload?.sessionKey
      if (!sessionKey) return

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
          } else if (data?.phase === 'end') {
            streamingRef.current.delete(sessionKey)
            setSessions(prev => prev.map(s =>
              s.id === sessionKey ? { ...s, isTyping: false } : s
            ))
            setCurrentRunId(null)
          }
          return
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
        handleChatEvent(event.payload, event.payload.eventType)
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
          const newConfig: GatewayConfig = {
            id: generateDbId(),
            name: new URL(url).hostname,
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

    // For each target agent, send the message to their gateway
    for (const agentId of targetAgents) {
      const gateway = manager.getGateway(agentId)
      if (!gateway || gateway.status !== 'connected') continue

      // Create a channel message record
      const msg: ChannelMessage = {
        id: generateDbId(),
        channelId,
        agentId: 'user', // Mark as from user
        text: targetAgentId ? `@${gatewayConfigs.find(g => g.id === targetAgentId)?.name}: ${text}` : text,
        timestamp: Date.now()
      }
      
      // Save the outgoing message
      await saveChannelMessage(msg)
      setChannelMessages(prev => {
        const next = new Map(prev)
        const existing = next.get(channelId) || []
        next.set(channelId, [...existing, msg])
        return next
      })

      // Send to the gateway (use main session for now)
      // The message will include channel context
      const channelContext = `[Channel: #${channel.name}] ${text}`
      try {
        // For now, broadcast to agent's main session
        // Future: Could use a dedicated channel session
        await gateway.chatSend('agent:main', channelContext)
      } catch (err) {
        console.error(`[ClawTabs] Failed to send to ${agentId}:`, err)
      }
    }
  }, [channels, gatewayConfigs])

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
        ) : viewMode === 'channels' ? (
          <>
            {/* Channel View */}
            <ChannelSidebar
              channels={channels}
              activeChannelId={activeChannelId}
              gateways={gatewayConfigs}
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
              sessionCount={chatSessions.length}
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
          </>
        )}
      </div>
      <BottomBar 
        sessionCount={sessions.length} 
        channelCount={channels.length}
        viewMode={viewMode}
        onToggleView={() => setViewMode(v => v === 'sessions' ? 'channels' : 'sessions')}
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
      />
      <ChannelModal
        isOpen={channelModalOpen}
        onClose={() => { setChannelModalOpen(false); setEditingChannel(null) }}
        gateways={gatewayConfigs}
        onCreateChannel={handleCreateChannel}
        editingChannel={editingChannel}
        onUpdateChannel={handleUpdateChannel}
      />
    </div>
  )
}

export default App
