interface BottomBarProps {
  sessionCount: number
  channelCount?: number
  taskCount?: number
  totalUnread?: number
  viewMode?: 'sessions' | 'channels' | 'tasks' | 'mission'
  onViewChange?: (view: 'sessions' | 'channels' | 'tasks' | 'mission') => void
}

export function BottomBar({ 
  sessionCount, 
  channelCount = 0, 
  taskCount = 0,
  totalUnread = 0, 
  viewMode = 'sessions', 
  onViewChange 
}: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <span className="bottom-item">
        <span className="bottom-gt">&gt;</span> Ready
      </span>
      
      {onViewChange && (
        <div className="bottom-tabs">
          <button 
            className={`bottom-tab ${viewMode === 'sessions' ? 'active' : ''}`}
            onClick={() => onViewChange('sessions')}
          >
            <span className="bottom-tab-icon">◉</span>
            Sessions
            <span className="bottom-tab-count">{sessionCount}</span>
          </button>
          <button 
            className={`bottom-tab ${viewMode === 'channels' ? 'active' : ''} ${totalUnread > 0 && viewMode !== 'channels' ? 'has-unread' : ''}`}
            onClick={() => onViewChange('channels')}
          >
            <span className="bottom-tab-icon">#</span>
            Channels
            <span className="bottom-tab-count">{channelCount}</span>
            {totalUnread > 0 && viewMode !== 'channels' && (
              <span className="bottom-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </button>
          <button 
            className={`bottom-tab ${viewMode === 'tasks' ? 'active' : ''}`}
            onClick={() => onViewChange('tasks')}
          >
            <span className="bottom-tab-icon">▣</span>
            Tasks
            <span className="bottom-tab-count">{taskCount}</span>
          </button>
          <button 
            className={`bottom-tab mission-tab ${viewMode === 'mission' ? 'active' : ''}`}
            onClick={() => onViewChange('mission')}
            title="Mission Control (Ctrl+M)"
          >
            <span className="bottom-tab-icon">◉</span>
            Mission
          </button>
        </div>
      )}
      
      <span className="bottom-spacer" />
      <span className="bottom-item bottom-status">Ready</span>
    </div>
  )
}
