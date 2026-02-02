import type { SystemStatus } from '../types'

interface TopBarProps {
  status: SystemStatus
  activeTab: 'chat' | 'ops'
  onTabChange: (tab: 'chat' | 'ops') => void
}

export function TopBar({ status, activeTab, onTabChange }: TopBarProps) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <span className="top-bar-logo">
          <img src="/mascot.jpg" alt="ClawTabs" className="logo-mascot" />
          <span className="logo-name">CLAWTABS</span>
          <span className="logo-version">v0.2</span>
        </span>
        <div className="top-bar-tabs">
          <button
            className={`top-tab ${activeTab === 'ops' ? 'top-tab-active' : ''}`}
            onClick={() => onTabChange('ops')}
          >
            <span className="top-tab-num">[1]</span> ✧ OPS
          </button>
          <button
            className={`top-tab ${activeTab === 'chat' ? 'top-tab-active' : ''}`}
            onClick={() => onTabChange('chat')}
          >
            <span className="top-tab-num">[2]</span> ▣ CHAT
          </button>
        </div>
      </div>
      <div className="top-bar-center">
        <span className="top-bar-section">▣ COMMUNICATIONS</span>
      </div>
      <div className="top-bar-right">
        <span className="top-bar-time">// {timeStr}</span>
        <span className={`top-bar-status ${status.connected ? 'status-connected' : 'status-disconnected'}`}>
          ◉ {status.connected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      </div>
    </div>
  )
}
