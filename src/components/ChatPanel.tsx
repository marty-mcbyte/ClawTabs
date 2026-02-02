import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Session } from '../types'

interface ChatPanelProps {
  session: Session
  onSendMessage: (text: string) => void
  onRename: (name: string) => void
}

export function ChatPanel({ session, onSendMessage, onRename }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(session.name)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [session.id])

  useEffect(() => {
    setEditName(session.name)
  }, [session.name])

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
        <div className="chat-header-left">
          <span className="chat-header-dot">■</span>
          {isEditingName ? (
            <input
              className="chat-header-rename"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim()) onRename(editName.trim())
                setIsEditingName(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (editName.trim()) onRename(editName.trim())
                  setIsEditingName(false)
                }
                if (e.key === 'Escape') setIsEditingName(false)
              }}
              autoFocus
            />
          ) : (
            <span
              className="chat-header-name"
              onDoubleClick={() => setIsEditingName(true)}
            >
              {session.name}
            </span>
          )}
          <button className="chat-header-edit" onClick={() => setIsEditingName(true)}>✎</button>
        </div>
        <div className="chat-header-right">
          <span className="chat-header-meta">
            SYS.{session.isTyping ? 'PROCESSING' : 'NOMINAL'} | MEM.OK | NET.STABLE
          </span>
        </div>
      </div>

      <div className="chat-messages">
        {session.messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">&gt;_</div>
            <div className="chat-empty-text">Transmission channel open.</div>
            <div className="chat-empty-hint">Enter message to begin communication.</div>
          </div>
        )}
        {session.messages.map(msg => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="message-avatar">■</div>
            )}
            <div className="message-body">
              <div className="message-label">
                {msg.role === 'user' ? 'USER.INPUT' : msg.role === 'assistant' ? 'SYS.RESPONSE' : 'SYS.ALERT'}
              </div>
              <div className="message-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const isInline = !className
                      return isInline ? (
                        <code className="inline-code" {...props}>{children}</code>
                      ) : (
                        <pre className="code-block">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      )
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="message-actions">
                <button className="msg-action-btn">&gt;</button>
              </div>
            )}
          </div>
        ))}
        {session.isTyping && (
          <div className="message message-assistant">
            <div className="message-avatar">■</div>
            <div className="message-body">
              <div className="message-label">SYS.RESPONSE</div>
              <div className="message-content">
                <span className="typing-indicator">
                  <span>●</span><span>●</span><span>●</span>
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="input-prompt">&gt;</div>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter message..."
          rows={1}
        />
        <button className="chat-send" onClick={handleSend} disabled={!input.trim()}>
          ✈
        </button>
      </div>
      <div className="chat-input-hint">Press Enter to send</div>
    </div>
  )
}
