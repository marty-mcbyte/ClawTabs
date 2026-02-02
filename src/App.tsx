import { useState, useCallback, useEffect, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { TopBar } from './components/TopBar'
import { BottomBar } from './components/BottomBar'
import type { Session, Message, SystemStatus } from './types'
import { Gateway } from './gateway'
import type { ConnectionStatus } from './gateway'
import './App.css'

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function getConfigFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return {
    token: params.get('token') || 'eae9203476a753ae79acfb39e0e85fbc81ff667a3e667bb4',
    url: params.get('gateway') || `ws://${window.location.hostname}:18789`,
  }
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'ops'>('chat')
  const [searchQuery, setSearchQuery] = useState('')
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected')
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const gwRef = useRef<Gateway | null>(null)
  // Track streaming content per session
  const streamingRef = useRef<Map<string, { msgId: string; content: string }>>(new Map())

  const status: SystemStatus = {
    connected: connStatus === 'connected',
    sysStatus: connStatus === 'connected' ? 'NOMINAL' : connStatus === 'connecting' ? 'DEGRADED' : 'ERROR',
    memStatus: 'OK',
    netStatus: connStatus === 'connected' ? 'STABLE' : connStatus === 'connecting' ? 'UNSTABLE' : 'DOWN'
  }

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  // Initialize gateway
  useEffect(() => {
    const { url, token } = getConfigFromUrl()
    const gw = new Gateway(url, token)
    gwRef.current = gw

    gw.setHandlers({
      onConnectionChange: (s) => {
        setConnStatus(s)
      },
      onChatEvent: (payload: any, eventType: string) => {
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
    })

    gw.connect()

    return () => {
      gw.disconnect()
    }
  }, [])

  // Load sessions when connected
  useEffect(() => {
    if (connStatus !== 'connected' || !gwRef.current) return

    gwRef.current.listSessions().then(async (remoteSessions: any[]) => {
      if (!Array.isArray(remoteSessions) || remoteSessions.length === 0) {
        // No sessions from gateway — create a local placeholder
        const fallback: Session = {
          id: 'general',
          name: 'General',
          messages: [],
          isActive: true,
          createdAt: Date.now()
        }
        setSessions([fallback])
        setActiveSessionId('general')
        return
      }

      const loaded: Session[] = remoteSessions.map((rs: any) => ({
        id: rs.sessionKey ?? rs.id ?? rs.sessionId ?? generateId(),
        name: rs.name ?? rs.label ?? rs.title ?? rs.sessionKey ?? 'Session',
        messages: [],
        isActive: true,
        createdAt: rs.createdAt ?? rs.created ?? Date.now()
      }))

      setSessions(loaded)
      setActiveSessionId(loaded[0].id)

      // Load history for first session
      try {
        const history = await gwRef.current!.chatHistory(loaded[0].id)
        if (Array.isArray(history) && history.length > 0) {
          const msgs: Message[] = history.map((m: any) => ({
            id: m.id ?? generateId(),
            role: m.role ?? 'assistant',
            content: m.content ?? m.text ?? '',
            timestamp: m.timestamp ?? m.ts ?? Date.now()
          }))
          setSessions(prev => prev.map(s =>
            s.id === loaded[0].id ? { ...s, messages: msgs } : s
          ))
        }
      } catch {}
    }).catch(() => {
      // Gateway connected but sessions.list failed — use fallback
      const fallback: Session = {
        id: 'general', name: 'General', messages: [], isActive: true, createdAt: Date.now()
      }
      setSessions([fallback])
      setActiveSessionId('general')
    })
  }, [connStatus])

  // Load history when switching sessions
  const loadHistory = useCallback(async (sessionId: string) => {
    if (!gwRef.current || connStatus !== 'connected') return
    try {
      const history = await gwRef.current.chatHistory(sessionId)
      if (Array.isArray(history) && history.length > 0) {
        const msgs: Message[] = history.map((m: any) => ({
          id: m.id ?? generateId(),
          role: m.role ?? 'assistant',
          content: m.content ?? m.text ?? '',
          timestamp: m.timestamp ?? m.ts ?? Date.now()
        }))
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, messages: msgs } : s
        ))
      }
    } catch {}
  }, [connStatus])

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    // Load history if messages empty
    const sess = sessions.find(s => s.id === id)
    if (sess && sess.messages.length === 0) {
      loadHistory(id)
    }
  }, [sessions, loadHistory])

  const createSession = useCallback(() => {
    const newSession: Session = {
      id: generateId(),
      name: `Transmission ${sessions.length + 1}`,
      messages: [],
      isActive: true,
      createdAt: Date.now()
    }
    setSessions(prev => [...prev, newSession])
    setActiveSessionId(newSession.id)
  }, [sessions.length])

  const closeSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id)
      if (filtered.length === 0) {
        const fallback: Session = {
          id: generateId(), name: 'General', messages: [], isActive: true, createdAt: Date.now()
        }
        setActiveSessionId(fallback.id)
        return [fallback]
      }
      if (activeSessionId === id) {
        setActiveSessionId(filtered[filtered.length - 1].id)
      }
      return filtered
    })
  }, [activeSessionId])

  const renameSession = useCallback((id: string, name: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }, [])

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

  const filteredSessions = searchQuery
    ? sessions.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sessions, activeSessionId, createSession, closeSession])

  const handleSendMessage = useCallback((text: string) => {
    if (!activeSession) return
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    addMessage(activeSession.id, userMsg)
    setTyping(activeSession.id, true)

    const gw = gwRef.current
    if (!gw || connStatus !== 'connected') {
      const errorMsg: Message = {
        id: generateId(),
        role: 'system',
        content: '⚠ Not connected to OpenClaw gateway.',
        timestamp: Date.now()
      }
      addMessage(activeSession.id, errorMsg)
      setTyping(activeSession.id, false)
      return
    }

    gw.chatSend(activeSession.id, text)
      .then((ack: any) => {
        if (ack?.runId) setCurrentRunId(ack.runId)
        // Response will stream via chat events
      })
      .catch(() => {
        const errorMsg: Message = {
          id: generateId(),
          role: 'system',
          content: '⚠ Failed to send message to gateway.',
          timestamp: Date.now()
        }
        addMessage(activeSession.id, errorMsg)
        setTyping(activeSession.id, false)
      })
  }, [activeSession, addMessage, setTyping, connStatus])

  const handleAbort = useCallback(() => {
    if (!activeSession || !gwRef.current) return
    gwRef.current.chatAbort(activeSession.id, currentRunId ?? undefined).catch(() => {})
    setTyping(activeSession.id, false)
    streamingRef.current.delete(activeSession.id)
    setCurrentRunId(null)
  }, [activeSession, currentRunId, setTyping])

  if (sessions.length === 0) {
    // Still loading
    return (
      <div className="app">
        <div className="scanline" />
        <TopBar status={status} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
          {connStatus === 'connecting' ? 'Connecting to gateway...' : connStatus === 'disconnected' ? 'Disconnected — retrying...' : 'Loading sessions...'}
        </div>
        <BottomBar sessionCount={0} />
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
      />
      <div className="main-content">
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
          sessionCount={sessions.length}
        />
        <ChatPanel
          session={activeSession}
          onSendMessage={handleSendMessage}
          onRename={(name) => renameSession(activeSession.id, name)}
          onAbort={activeSession?.isTyping ? handleAbort : undefined}
        />
      </div>
      <BottomBar sessionCount={sessions.length} />
    </div>
  )
}

export default App
