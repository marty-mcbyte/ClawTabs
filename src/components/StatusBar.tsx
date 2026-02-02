interface StatusBarProps {
  sessionCount: number
  activeSession: string
}

export function StatusBar({ sessionCount, activeSession }: StatusBarProps) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="status-bar">
      <span className="status-item">
        <span className="status-dot status-dot-green" /> CONNECTED
      </span>
      <span className="status-item">SESSIONS: {sessionCount}</span>
      <span className="status-item">ACTIVE: {activeSession}</span>
      <span className="status-spacer" />
      <span className="status-item">ClawTabs v0.1.0</span>
      <span className="status-item">{timeStr}</span>
    </div>
  )
}
