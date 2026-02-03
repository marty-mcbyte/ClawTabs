import { useMemo } from 'react'
import type { GatewayConfig, Session } from '../types'
import './AgentSidebar.css'

interface AgentSidebarProps {
  gateways: GatewayConfig[]
  sessions: Session[]
  selectedGatewayId: string | null // null = show all
  onSelectGateway: (id: string | null) => void
  onOpenSettings: () => void
}

// Check if session is an ops/subagent session (same logic as App.tsx)
const OPS_PATTERNS = [/subagent/i, /sub-agent/i, /isolated/i, /cron/i, /heartbeat/i, /background/i, /worker/i, /spawned/i]
function isOpsSession(session: { id: string; name: string }): boolean {
  return OPS_PATTERNS.some(p => p.test(session.name) || p.test(session.id))
}

// Generate consistent color for gateway ID
function getGatewayColor(index: number): string {
  const colors = ['#00ff9d', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#06b6d4', '#f97316']
  return colors[index % colors.length]
}

function getStatusIcon(status: GatewayConfig['status']): string {
  switch (status) {
    case 'connected': return '●'
    case 'connecting': return '◐'
    case 'disconnected': return '○'
    case 'error': return '✕'
    default: return '?'
  }
}

function getStatusClass(status: GatewayConfig['status']): string {
  switch (status) {
    case 'connected': return 'status-online'
    case 'connecting': return 'status-connecting'
    case 'disconnected': return 'status-offline'
    case 'error': return 'status-error'
    default: return ''
  }
}

export function AgentSidebar({
  gateways,
  sessions,
  selectedGatewayId,
  onSelectGateway,
  onOpenSettings
}: AgentSidebarProps) {
  // Count chat sessions per gateway (excludes ops/subagent sessions)
  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const session of sessions) {
      if (session.gatewayId && !isOpsSession(session)) {
        counts[session.gatewayId] = (counts[session.gatewayId] || 0) + 1
      }
    }
    return counts
  }, [sessions])
  
  // Total chat sessions (for "All Agents" count)
  const totalChatSessions = useMemo(() => {
    return sessions.filter(s => !isOpsSession(s)).length
  }, [sessions])

  // Count active (typing) sessions per gateway
  const activeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const session of sessions) {
      if (session.gatewayId && session.isTyping) {
        counts[session.gatewayId] = (counts[session.gatewayId] || 0) + 1
      }
    }
    return counts
  }, [sessions])

  const connectedCount = gateways.filter(g => g.status === 'connected').length

  return (
    <div className="agent-sidebar">
      <div className="agent-sidebar-header">
        <span className="agent-sidebar-title">AGENTS</span>
        <span className="agent-sidebar-count">{connectedCount}/{gateways.length}</span>
      </div>

      <div className="agent-list">
        {/* "All" option */}
        <div
          className={`agent-item ${selectedGatewayId === null ? 'agent-item-active' : ''}`}
          onClick={() => onSelectGateway(null)}
        >
          <div className="agent-avatar" style={{ background: 'var(--bg-tertiary)' }}>
            <span>∀</span>
          </div>
          <div className="agent-info">
            <div className="agent-name">All Agents</div>
            <div className="agent-meta">{totalChatSessions} sessions</div>
          </div>
        </div>

        {/* Individual gateways/agents */}
        {gateways.map((gateway, index) => {
          const color = getGatewayColor(index)
          const sessionCount = sessionCounts[gateway.id] || 0
          const activeCount = activeCounts[gateway.id] || 0

          return (
            <div
              key={gateway.id}
              className={`agent-item ${selectedGatewayId === gateway.id ? 'agent-item-active' : ''} ${gateway.status !== 'connected' ? 'agent-item-disabled' : ''}`}
              onClick={() => gateway.status === 'connected' && onSelectGateway(gateway.id)}
              title={gateway.error || gateway.url}
            >
              <div className="agent-avatar" style={{ borderColor: color }}>
                <span style={{ color }}>{gateway.name.charAt(0).toUpperCase()}</span>
                <span className={`agent-status-dot ${getStatusClass(gateway.status)}`}>
                  {getStatusIcon(gateway.status)}
                </span>
              </div>
              <div className="agent-info">
                <div className="agent-name">{gateway.name}</div>
                <div className="agent-meta">
                  {gateway.status === 'connected' ? (
                    <>
                      {sessionCount} session{sessionCount !== 1 ? 's' : ''}
                      {activeCount > 0 && <span className="agent-active"> • {activeCount} active</span>}
                    </>
                  ) : gateway.status === 'connecting' ? (
                    'Connecting...'
                  ) : gateway.status === 'error' ? (
                    <span className="agent-error">Error</span>
                  ) : (
                    'Offline'
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button className="agent-sidebar-settings" onClick={onOpenSettings}>
        <span>⚙</span>
        <span>Manage Gateways</span>
      </button>
    </div>
  )
}
