import { useState } from 'react'
import { Session } from '../types'

interface TabBarProps {
  sessions: Session[]
  activeSessionId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
}

export function TabBar({ sessions, activeSessionId, onSelect, onCreate, onClose, onRename }: TabBarProps) {
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
    <div className="tab-bar">
      <div className="tab-bar-logo">
        <span className="logo-claw">CLAW</span>
        <span className="logo-tabs">TABS</span>
      </div>
      <div className="tab-list">
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className={`tab ${session.id === activeSessionId ? 'tab-active' : ''} ${session.isTyping ? 'tab-typing' : ''}`}
            onClick={() => onSelect(session.id)}
          >
            <span className="tab-index">{index + 1}</span>
            {editingId === session.id ? (
              <input
                className="tab-rename-input"
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
              <span
                className="tab-name"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startRename(session.id, session.name)
                }}
              >
                {session.name}
              </span>
            )}
            {session.isTyping && <span className="tab-typing-indicator">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onClose(session.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-new" onClick={onCreate} title="New Session (Ctrl+N)">
        +
      </button>
    </div>
  )
}
