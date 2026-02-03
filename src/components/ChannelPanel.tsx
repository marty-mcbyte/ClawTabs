import { useState, useCallback, useRef, useEffect } from 'react'
import type { Channel, ChannelMessage, GatewayConfig } from '../types'
import './ChannelPanel.css'

interface ChannelPanelProps {
  channel: Channel
  messages: ChannelMessage[]
  gateways: GatewayConfig[]
  typingAgentIds?: string[]
  onSendMessage: (channelId: string, text: string, targetAgentId?: string) => void
  onRename: (name: string) => void
  onEditMembers: () => void
}

// Generate consistent color for gateway ID
function getAgentColor(agentId: string, gateways: GatewayConfig[]): string {
  const colors = ['#00ff9d', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#06b6d4', '#f97316']
  const index = gateways.findIndex(g => g.id === agentId)
  return index >= 0 ? colors[index % colors.length] : 'var(--text-dim)'
}

function getAgentName(agentId: string, gateways: GatewayConfig[]): string {
  return gateways.find(g => g.id === agentId)?.name || 'Unknown'
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChannelPanel({
  channel,
  messages,
  gateways,
  typingAgentIds = [],
  onSendMessage,
  onRename,
  onEditMembers
}: ChannelPanelProps) {
  const [input, setInput] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(channel.name)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Parse @mentions and extract target agent
  const parseMessage = (text: string): { cleanText: string; targetAgentId?: string } => {
    const mentionMatch = text.match(/^@(\w+)\s+/)
    if (mentionMatch) {
      const mentionName = mentionMatch[1].toLowerCase()
      const targetGateway = gateways.find(g => 
        g.name.toLowerCase() === mentionName || 
        g.name.toLowerCase().startsWith(mentionName)
      )
      if (targetGateway) {
        return {
          cleanText: text.slice(mentionMatch[0].length),
          targetAgentId: targetGateway.id
        }
      }
    }
    return { cleanText: text }
  }

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    
    const { cleanText, targetAgentId } = parseMessage(text)
    onSendMessage(channel.id, targetAgentId ? cleanText : text, targetAgentId)
    setInput('')
    inputRef.current?.focus()
  }, [input, channel.id, onSendMessage, gateways])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== channel.name) {
      onRename(renameValue.trim())
    }
    setIsRenaming(false)
  }

  // Get member agents info
  const memberAgents = channel.memberAgentIds
    .map(id => gateways.find(g => g.id === id))
    .filter(Boolean) as GatewayConfig[]

  return (
    <div className="channel-panel">
      {/* Channel Header */}
      <div className="channel-header">
        <div className="channel-header-left">
          <span className="channel-hash">#</span>
          {isRenaming ? (
            <input
              className="channel-rename-input"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setIsRenaming(false)
              }}
              autoFocus
            />
          ) : (
            <span 
              className="channel-name" 
              onClick={() => { setIsRenaming(true); setRenameValue(channel.name) }}
              title="Click to rename"
            >
              {channel.name}
            </span>
          )}
          {channel.description && (
            <span className="channel-description">— {channel.description}</span>
          )}
        </div>
        <div className="channel-header-right">
          <div className="channel-members" onClick={onEditMembers} title="Edit members">
            {memberAgents.slice(0, 3).map((agent, i) => (
              <span 
                key={agent.id} 
                className="channel-member-dot"
                style={{ 
                  backgroundColor: getAgentColor(agent.id, gateways),
                  marginLeft: i > 0 ? '-6px' : 0,
                  zIndex: 3 - i
                }}
              />
            ))}
            {memberAgents.length > 3 && (
              <span className="channel-member-more">+{memberAgents.length - 3}</span>
            )}
            <span className="channel-member-count">{memberAgents.length} agents</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="channel-messages">
        {messages.length === 0 ? (
          <div className="channel-empty">
            <div className="channel-empty-icon">#</div>
            <div className="channel-empty-title">Welcome to #{channel.name}</div>
            <div className="channel-empty-desc">
              This is the beginning of the channel. Send a message to start the conversation.
            </div>
            <div className="channel-empty-hint">
              Tip: Use @AgentName to direct a message to a specific agent
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const agentColor = getAgentColor(msg.agentId, gateways)
            const agentName = getAgentName(msg.agentId, gateways)
            
            return (
              <div key={msg.id} className="channel-message">
                <div 
                  className="channel-message-avatar"
                  style={{ borderColor: agentColor }}
                >
                  <span style={{ color: agentColor }}>{agentName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="channel-message-content">
                  <div className="channel-message-header">
                    <span className="channel-message-author" style={{ color: agentColor }}>
                      {agentName}
                    </span>
                    <span className="channel-message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="channel-message-text">{msg.text}</div>
                </div>
              </div>
            )
          })
        )}
        {/* Typing indicators */}
        {typingAgentIds.length > 0 && (
          <div className="channel-typing">
            {typingAgentIds.map(agentId => {
              const color = getAgentColor(agentId, gateways)
              const name = getAgentName(agentId, gateways)
              return (
                <span key={agentId} className="channel-typing-agent">
                  <span className="channel-typing-dot" style={{ backgroundColor: color }}>●</span>
                  <span style={{ color }}>{name}</span>
                </span>
              )
            })}
            <span className="channel-typing-text">
              {typingAgentIds.length === 1 ? 'is typing...' : 'are typing...'}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="channel-input-container">
        <div className="channel-input-wrapper">
          <textarea
            ref={inputRef}
            className="channel-input"
            placeholder={`Message #${channel.name}... (use @AgentName to target)`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button 
            className="channel-send-btn"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
