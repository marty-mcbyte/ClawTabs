import { useState, useCallback, useEffect } from 'react'
import { TabBar } from './components/TabBar'
import { ChatPanel } from './components/ChatPanel'
import { StatusBar } from './components/StatusBar'
import { Session, Message } from './types'
import './App.css'

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([
    { id: generateId(), name: 'General', messages: [], isActive: true, createdAt: Date.now() }
  ])
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id)

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  const createSession = useCallback(() => {
    const newSession: Session = {
      id: generateId(),
      name: `Session ${sessions.length + 1}`,
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
      // Ctrl+1-9 to switch tabs
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

  return (
    <div className="app">
      <div className="scanline" />
      <TabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onCreate={createSession}
        onClose={closeSession}
        onRename={renameSession}
      />
      <ChatPanel
        session={activeSession}
        onSendMessage={(text) => {
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
        }}
      />
      <StatusBar
        sessionCount={sessions.length}
        activeSession={activeSession.name}
      />
    </div>
  )
}

export default App
