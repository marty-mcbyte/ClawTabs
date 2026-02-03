import { useState } from 'react'
import type { Session, GatewayConfig } from '../types'

// Generate consistent color for gateway ID
function getGatewayColor(gatewayId: string | undefined, gateways: GatewayConfig[]): string {
  if (!gatewayId) return 'var(--text-dim)'
  const colors = ['#00ff9d', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#06b6d4', '#f97316']
  const index = gateways.findIndex(g => g.id === gatewayId)
  return colors[index % colors.length]
}

interface SidebarProps {
  sessions: Session[]
  activeSessionId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  getPreview: (s: Session) => string
  getTimeAgo: (ts: number) => string
  sessionCount: number
  splitSessionId?: string
  gateways?: GatewayConfig[]
}

export function Sidebar({
  sessions, activeSessionId, onSelect, onCreate, onClose, onRename,
  searchQuery, onSearchChange, getPreview, getTimeAgo, sessionCount, splitSessionId,
  gateways = []
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const startRename = (id: string, currentName: string) => {
    setEditingId(id)
    setEditValue(currentName)
  }

  const finishRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onClose(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      // Auto-clear confirmation after 3 seconds
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000)
    }
  }

  return (
    <div className="sidebar" style={{ position: 'relative' }}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="sidebar-dot">●</span>
          <span>TRANSMISSIONS</span>
          <span className="sidebar-count">[{sessionCount}]</span>
        </div>
      </div>

      <button className="sidebar-new" onClick={onCreate}>
        + NEW TRANSMISSION
      </button>

      <div className="sidebar-search">
        <span className="search-icon">⌕</span>
        <input
          className="search-input"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      <div className="sidebar-list">
        {sessions.map(session => {
          const lastMsg = session.messages[session.messages.length - 1]
          const timeAgo = lastMsg ? getTimeAgo(lastMsg.timestamp) : getTimeAgo(session.createdAt)

          return (
            <div
              key={session.id}
              className={`sidebar-item ${session.id === activeSessionId ? 'sidebar-item-active' : ''}`}
              onClick={() => onSelect(session.id)}
            >
              <div className="sidebar-item-indicator">
                {gateways.length > 1 && session.gatewayId && (
                  <span 
                    className="gateway-dot" 
                    style={{ color: getGatewayColor(session.gatewayId, gateways) }}
                    title={gateways.find(g => g.id === session.gatewayId)?.name || 'Unknown'}
                  >●</span>
                )}
                {session.id === activeSessionId && <span className="active-dot">●</span>}
                {session.id === splitSessionId && <span className="split-dot">⫿</span>}
                {session.isTyping && <span className="typing-dot">◉</span>}
              </div>
              <div className="sidebar-item-content">
                {editingId === session.id ? (
                  <input
                    className="sidebar-rename-input"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') finishRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div className="sidebar-item-name">
                    {session.name}
                  </div>
                )}
                <div className="sidebar-item-preview">{getPreview(session)}</div>
              </div>
              <div className="sidebar-item-meta">
                <div className="sidebar-item-time">// {timeAgo}</div>
                <div className="sidebar-item-actions">
                  <button
                    className="sidebar-action-btn sidebar-action-edit"
                    onClick={(e) => { e.stopPropagation(); startRename(session.id, session.name) }}
                    title="Rename"
                  >
                    ✏
                  </button>
                  <button
                    className={`sidebar-action-btn sidebar-action-delete ${confirmDeleteId === session.id ? 'confirm' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }}
                    title={confirmDeleteId === session.id ? 'Click again to confirm' : 'Delete'}
                  >
                    {confirmDeleteId === session.id ? '✕' : '🗑'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
