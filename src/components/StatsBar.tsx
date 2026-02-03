import './StatsBar.css'

interface StatsBarProps {
  activeAgentCount: number
  totalAgentCount: number
  taskCount: number
  sessionCount: number
  showFeed?: boolean
  onToggleFeed?: () => void
}

export function StatsBar({
  activeAgentCount,
  totalAgentCount,
  taskCount,
  sessionCount,
  showFeed,
  onToggleFeed
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
        
        {onToggleFeed && (
          <>
            <div className="stat-divider">•</div>
            <button 
              className={`stat-toggle ${showFeed ? 'active' : ''}`}
              onClick={onToggleFeed}
              title={showFeed ? 'Hide Live Feed' : 'Show Live Feed'}
            >
              <span className="stat-icon">📡</span>
              <span className="stat-label">FEED</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
