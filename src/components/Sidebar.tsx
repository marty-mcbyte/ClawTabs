import { useState } from 'react'
import { Session } from '../types'

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
}

export function Sidebar({
  sessions, activeSessionId, onSelect, onCreate, onClose, onRename,
  searchQuery, onSearchChange, getPreview, getTimeAgo, sessionCount
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

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

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="sidebar-dot">●</span>
          <span>TRANSMISSIONS</span>
          <span className="sidebar-count">[{sessionCount}]</span>
        </div>
      </div>

      <button className="sidebar-new" onClick={onCreate}>
        + NEW TRANSMISSION
        <span className="sidebar-new-count">({sessionCount})</span>
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
              onContextMenu={(e) => {
                e.preventDefault()
                onClose(session.id)
              }}
            >
              <div className="sidebar-item-indicator">
                {session.id === activeSessionId && <span className="active-dot">●</span>}
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
                  <div
                    className="sidebar-item-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startRename(session.id, session.name)
                    }}
                  >
                    {session.name}
                  </div>
                )}
                <div className="sidebar-item-preview">{getPreview(session)}</div>
              </div>
              <div className="sidebar-item-time">// {timeAgo}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
