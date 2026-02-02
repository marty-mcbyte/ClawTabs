interface BottomBarProps {
  sessionCount: number
}

export function BottomBar({ sessionCount }: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <span className="bottom-item">
        <span className="bottom-gt">&gt;</span> Ready
      </span>
      <span className="bottom-spacer" />
      <span className="bottom-item">Sessions: {sessionCount}</span>
      <span className="bottom-item">Ready</span>
    </div>
  )
}
