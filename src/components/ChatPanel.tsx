import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Session } from '../types'

// Compress images to avoid WebSocket 1009 (message too big) errors
async function compressImage(file: File, maxDimension = 1920, quality = 0.8): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      
      // Scale down if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to JPEG for better compression
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve({ dataUrl, mimeType: 'image/jpeg' })
      
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

interface ChatPanelProps {
  session: Session
  onSendMessage: (text: string, attachments?: any[]) => void
  onRename: (name: string) => void
  onAbort?: () => void
}

export function ChatPanel({ session, onSendMessage, onRename, onAbort }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(session.name)
  const [stagedImage, setStagedImage] = useState<{ dataUrl: string; mimeType: string } | null>(null)
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
    if (!text && !stagedImage) return
    const attachments = stagedImage ? [stagedImage] : undefined
    const msgText = text || (stagedImage ? '[image]' : '')
    setInput('')
    setStagedImage(null)
    onSendMessage(msgText, attachments)
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        try {
          // Compress image to avoid WebSocket size limits
          const compressed = await compressImage(file)
          setStagedImage(compressed)
        } catch (err) {
          console.error('Failed to compress image:', err)
          // Fallback to raw file
          const reader = new FileReader()
          reader.onload = () => {
            setStagedImage({ dataUrl: reader.result as string, mimeType: file.type })
          }
          reader.readAsDataURL(file)
        }
        return
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // @ts-ignore used in template
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
              {msg.attachments?.map((att, i) => (
                <div key={i} className="message-attachment">
                  <img src={att.dataUrl} alt="attachment" />
                </div>
              ))}
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
          onPaste={handlePaste}
          placeholder="Enter message..."
          rows={1}
        />
        {onAbort ? (
          <button className="chat-send" onClick={onAbort} title="Stop response">
            ■
          </button>
        ) : (
          <button className="chat-send" onClick={handleSend} disabled={!input.trim() && !stagedImage}>
            ✈
          </button>
        )}
      </div>
      {stagedImage && (
        <div className="staged-image-preview">
          <img src={stagedImage.dataUrl} alt="Pasted" />
          <button className="staged-image-remove" onClick={() => setStagedImage(null)}>✕</button>
        </div>
      )}
      <div className="chat-input-hint">Press Enter to send</div>
    </div>
  )
}
