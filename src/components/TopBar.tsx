import type { SystemStatus } from '../types'

interface TopBarProps {
  status: SystemStatus
  activeTab: 'chat' | 'ops'
  onTabChange: (tab: 'chat' | 'ops') => void
  chatCount?: number
  opsCount?: number
  isSplit?: boolean
  onToggleSplit?: () => void
  gatewayCount?: number
  connectedGatewayCount?: number
  onOpenGatewaySettings?: () => void
}

export function TopBar({ 
  status, 
  activeTab, 
  onTabChange, 
  chatCount = 0, 
  opsCount = 0, 
  isSplit, 
  onToggleSplit,
  gatewayCount = 0,
  connectedGatewayCount = 0,
  onOpenGatewaySettings
}: TopBarProps) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <span className="top-bar-logo">
          <img src="/mascot.jpg" alt="ClawTabs" className="logo-mascot" />
          <span className="logo-name">CLAWTABS</span>
          <span className="logo-version">v0.5</span>
        </span>
        <div className="top-bar-tabs">
          <button
            className={`top-tab ${activeTab === 'ops' ? 'top-tab-active' : ''}`}
            onClick={() => onTabChange('ops')}
          >
            <span className="top-tab-num">[1]</span> ✧ OPS {opsCount > 0 && <span className="top-tab-count">{opsCount}</span>}
          </button>
          <button
            className={`top-tab ${activeTab === 'chat' ? 'top-tab-active' : ''}`}
            onClick={() => onTabChange('chat')}
          >
            <span className="top-tab-num">[2]</span> ▣ CHAT {chatCount > 0 && <span className="top-tab-count">{chatCount}</span>}
          </button>
        </div>
      </div>
      <div className="top-bar-center">
        <span className="top-bar-section">▣ COMMUNICATIONS</span>
        {onToggleSplit && (
          <button
            className={`split-toggle-btn ${isSplit ? 'split-active' : ''}`}
            onClick={onToggleSplit}
            title={isSplit ? 'Close split view (Ctrl+\\)' : 'Split view (Ctrl+\\)'}
          >
            ⫿
          </button>
        )}
      </div>
      <div className="top-bar-right">
        <span className="top-bar-time">// {timeStr}</span>
        <span className={`top-bar-status ${status.connected ? 'status-connected' : 'status-disconnected'}`}>
          ◉ {status.connected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
        {onOpenGatewaySettings && (
          <button 
            className="gateway-settings-btn"
            onClick={onOpenGatewaySettings}
            title="Gateway Settings"
          >
            ⚙ {connectedGatewayCount}/{gatewayCount}
          </button>
        )}
      </div>
    </div>
  )
}
