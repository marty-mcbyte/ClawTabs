import { useState, useRef, useEffect } from 'react'
import { Session } from '../types'

interface ChatPanelProps {
  session: Session
  onSendMessage: (text: string) => void
}

export function ChatPanel({ session, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [session.id])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    onSendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-header-name">{session.name}</span>
        <span className="chat-header-id">#{session.id}</span>
        <span className="chat-header-count">{session.messages.length} messages</span>
      </div>
      <div className="chat-messages">
        {session.messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">⟩_</div>
            <div className="chat-empty-text">New session initialized.</div>
            <div className="chat-empty-hint">Type a message to begin.</div>
          </div>
        )}
        {session.messages.map(msg => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'user' ? '▸ YOU' : msg.role === 'assistant' ? '◂ CLAW' : '◆ SYS'}
              </span>
              <span className="message-time">{formatTime(msg.timestamp)}</span>
            </div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {session.isTyping && (
          <div className="message message-assistant">
            <div className="message-header">
              <span className="message-role">◂ CLAW</span>
            </div>
            <div className="message-content typing-indicator">
              <span>●</span><span>●</span><span>●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <div className="input-prompt">⟩</div>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          rows={1}
        />
        <button className="chat-send" onClick={handleSend} disabled={!input.trim()}>
          SEND
        </button>
      </div>
    </div>
  )
}
