import './StatsBar.css'

interface StatsBarProps {
  activeAgentCount: number
  totalAgentCount: number
  taskCount: number
  sessionCount: number
}

export function StatsBar({
  activeAgentCount,
  totalAgentCount,
  taskCount,
  sessionCount
}: StatsBarProps) {
  return (
    <div className="stats-bar">
      <div className="stats-bar-inner">
        <div className="stat-item">
          <span className="stat-icon stat-icon-agents">◉</span>
          <span className="stat-value">{activeAgentCount}</span>
          <span className="stat-label">ACTIVE</span>
          <span className="stat-secondary">/ {totalAgentCount}</span>
        </div>
        
        <div className="stat-divider">•</div>
        
        <div className="stat-item">
          <span className="stat-icon stat-icon-tasks">▣</span>
          <span className="stat-value">{taskCount}</span>
          <span className="stat-label">TASKS</span>
        </div>
        
        <div className="stat-divider">•</div>
        
        <div className="stat-item">
          <span className="stat-icon stat-icon-sessions">◈</span>
          <span className="stat-value">{sessionCount}</span>
          <span className="stat-label">SESSIONS</span>
        </div>
      </div>
    </div>
  )
}
