interface BottomBarProps {
  sessionCount: number
  channelCount?: number
  totalUnread?: number
  viewMode?: 'sessions' | 'channels'
  onToggleView?: () => void
}

export function BottomBar({ sessionCount, channelCount = 0, totalUnread = 0, viewMode = 'sessions', onToggleView }: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <span className="bottom-item">
        <span className="bottom-gt">&gt;</span> Ready
      </span>
      {onToggleView && (
        <button className={`bottom-toggle ${totalUnread > 0 && viewMode === 'sessions' ? 'has-unread' : ''}`} onClick={onToggleView}>
          {viewMode === 'sessions' ? (
            <>
              <span className="bottom-toggle-icon">#</span>
              Channels ({channelCount})
              {totalUnread > 0 && <span className="bottom-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}
            </>
          ) : (
            <>
              <span className="bottom-toggle-icon">◉</span>
              Sessions ({sessionCount})
            </>
          )}
        </button>
      )}
      <span className="bottom-spacer" />
      <span className="bottom-item">
        {viewMode === 'sessions' ? `Sessions: ${sessionCount}` : `Channels: ${channelCount}`}
      </span>
      <span className="bottom-item">Ready</span>
    </div>
  )
}
