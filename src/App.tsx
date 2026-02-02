import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { TopBar } from './components/TopBar'
import { BottomBar } from './components/BottomBar'
import { Session, Message, SystemStatus } from './types'
import './App.css'

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

const defaultStatus: SystemStatus = {
  connected: true,
  sysStatus: 'NOMINAL',
  memStatus: 'OK',
  netStatus: 'STABLE'
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([
    { id: generateId(), name: 'General', messages: [], isActive: true, createdAt: Date.now() }
  ])
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id)
  const [activeTab, setActiveTab] = useState<'chat' | 'ops'>('chat')
  const [searchQuery, setSearchQuery] = useState('')
  const [status] = useState<SystemStatus>(defaultStatus)

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

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
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    addMessage(activeSession.id, userMsg)
    setTyping(activeSession.id, true)

    // Connect to OpenClaw gateway
    fetch(`http://127.0.0.1:18789/api/sessions/${activeSession.id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
      .then(r => r.json())
      .then(data => {
        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: data.reply || data.message || 'No response',
          timestamp: Date.now()
        }
        addMessage(activeSession.id, assistantMsg)
        setTyping(activeSession.id, false)
      })
      .catch(() => {
        const errorMsg: Message = {
          id: generateId(),
          role: 'system',
          content: '⚠ Connection to OpenClaw gateway failed. Is it running on port 18789?',
          timestamp: Date.now()
        }
        addMessage(activeSession.id, errorMsg)
        setTyping(activeSession.id, false)
      })
  }, [activeSession.id, addMessage, setTyping])

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
          onSelect={setActiveSessionId}
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
        />
      </div>
      <BottomBar sessionCount={sessions.length} />
    </div>
  )
}

export default App
