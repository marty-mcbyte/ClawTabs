import { useState, useCallback, useEffect, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { SplitView } from './components/SplitView'
import { TopBar } from './components/TopBar'
import { BottomBar } from './components/BottomBar'
import { OpsPanel } from './components/OpsPanel'
import { LandingPage } from './components/LandingPage'
import type { Session, Message, SystemStatus } from './types'
import { Gateway } from './gateway'
import type { ConnectionStatus } from './gateway'
import './App.css'

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
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

  // Initialize gateway
  useEffect(() => {
    const { url, token, hasExplicitGateway } = getConfigFromUrl()
    
    // If no explicit gateway URL provided, skip connection and show landing immediately
    if (!hasExplicitGateway) {
      setShowLanding(true)
      return
    }
    
    const gw = new Gateway(url, token)
    gwRef.current = gw

    gw.setHandlers({
      onConnectionChange: (s) => {
        setConnStatus(s)
        if (s === 'connected') {
          failCountRef.current = 0
          setShowLanding(false)
        } else if (s === 'disconnected' && !hasExplicitGateway) {
          failCountRef.current++
          // Show landing after 2 failed attempts (first connect + first reconnect)
          if (failCountRef.current >= 2) {
            setShowLanding(true)
          }
        }
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
      console.log('[GW] sessions.list response:', JSON.stringify(remoteSessions).substring(0, 500))
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
        id: rs.key ?? rs.sessionKey ?? rs.id ?? generateId(),
        name: rs.displayName ?? rs.name ?? rs.label ?? rs.title ?? rs.key ?? 'Session',
        messages: [],
        isActive: true,
        createdAt: rs.createdAt ?? rs.created ?? Date.now()
      }))

      setSessions(loaded)
      setActiveSessionId(loaded[0].id)

      // Load history for all sessions
      for (const sess of loaded) {
        try {
          const history = await gwRef.current!.chatHistory(sess.id)
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
        } catch {}
      }
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
          content: extractContent(m.content) || m.text || '',
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
    // Also delete from gateway
    gwRef.current?.deleteSession(id).catch(() => {})
  }, [activeSessionId])

  const renameSession = useCallback((id: string, name: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    gwRef.current?.renameSession(id, name).catch(() => {})
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

  const chatSessions = sessions.filter(s => !isOpsSession(s))
  const opsSessions = sessions.filter(s => isOpsSession(s))

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
  }, [sessions, activeSessionId, createSession, closeSession])

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

    const gw = gwRef.current
    if (!gw || connStatus !== 'connected') {
      addMessage(sessionId, { id: generateId(), role: 'system', content: '⚠ Not connected to OpenClaw gateway.', timestamp: Date.now() })
      setTyping(sessionId, false)
      return
    }

    gw.chatSend(sessionId, text, attachments)
      .then((ack: any) => { if (ack?.runId) setCurrentRunId(ack.runId) })
      .catch(() => {
        addMessage(sessionId, { id: generateId(), role: 'system', content: '⚠ Failed to send message to gateway.', timestamp: Date.now() })
        setTyping(sessionId, false)
      })
  }, [addMessage, setTyping, connStatus])

  const handleSendMessage = useCallback((text: string, attachments?: any[]) => {
    if (!activeSession) return
    handleSendMessageForSession(activeSession.id, text, attachments)
  }, [activeSession, handleSendMessageForSession])

  const handleAbortForSession = useCallback((sessionId: string) => {
    if (!gwRef.current) return
    gwRef.current.chatAbort(sessionId, currentRunId ?? undefined).catch(() => {})
    setTyping(sessionId, false)
    streamingRef.current.delete(sessionId)
    setCurrentRunId(null)
  }, [currentRunId, setTyping])

  const handleAbort = useCallback(() => {
    if (!activeSession) return
    handleAbortForSession(activeSession.id)
  }, [activeSession, handleAbortForSession])

  if (showLanding) {
    return <LandingPage />
  }

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
        chatCount={chatSessions.length}
        opsCount={opsSessions.length}
        isSplit={isSplit}
        onToggleSplit={toggleSplit}
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
        ) : (
          <>
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
      <BottomBar sessionCount={sessions.length} />
    </div>
  )
}

export default App
