import { useState, useRef, useCallback, useEffect } from 'react'
import { ChatPanel } from './ChatPanel'
import type { Session } from '../types'

interface SplitViewProps {
  leftSession: Session
  rightSession: Session
  allSessions: Session[]
  onSendMessage: (sessionId: string, text: string, attachments?: any[]) => void
  onRename: (sessionId: string, name: string) => void
  onAbort: (sessionId: string) => void
  onSelectRight: (sessionId: string) => void
  onCloseSplit: () => void
  splitRatio: number
  onSplitRatioChange: (ratio: number) => void
}

export function SplitView({
  leftSession, rightSession, allSessions, onSendMessage, onRename, onAbort,
  onSelectRight, onCloseSplit, splitRatio, onSplitRatioChange
}: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [showSessionPicker, setShowSessionPicker] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = Math.min(0.8, Math.max(0.2, (e.clientX - rect.left) / rect.width))
      onSplitRatioChange(ratio)
    }
    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onSplitRatioChange])

  return (
    <div className="split-view" ref={containerRef}>
      <div className="split-pane split-pane-left" style={{ width: `${splitRatio * 100}%` }}>
        <ChatPanel
          session={leftSession}
          onSendMessage={(text, att) => onSendMessage(leftSession.id, text, att)}
          onRename={(name) => onRename(leftSession.id, name)}
          onAbort={leftSession.isTyping ? () => onAbort(leftSession.id) : undefined}
        />
      </div>

      <div className="split-divider" onMouseDown={handleMouseDown}>
        <div className="split-divider-line" />
        <button className="split-divider-close" onClick={onCloseSplit} title="Close split (Ctrl+\\)">✕</button>
      </div>

      <div className="split-pane split-pane-right" style={{ width: `${(1 - splitRatio) * 100}%` }}>
        <div className="split-session-selector">
          <button className="split-session-btn" onClick={() => setShowSessionPicker(!showSessionPicker)}>
            ▣ {rightSession.name}
            <span className="split-session-arrow">▾</span>
          </button>
          {showSessionPicker && (
            <div className="split-session-dropdown">
              {allSessions.filter(s => s.id !== leftSession.id).map(s => (
                <button
                  key={s.id}
                  className={`split-session-option ${s.id === rightSession.id ? 'active' : ''}`}
                  onClick={() => { onSelectRight(s.id); setShowSessionPicker(false) }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <ChatPanel
          session={rightSession}
          onSendMessage={(text, att) => onSendMessage(rightSession.id, text, att)}
          onRename={(name) => onRename(rightSession.id, name)}
          onAbort={rightSession.isTyping ? () => onAbort(rightSession.id) : undefined}
        />
      </div>
    </div>
  )
}
