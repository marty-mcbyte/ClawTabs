import { useMemo } from 'react'
import type { GatewayConfig, Session, WorkingStatus } from '../types'
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

function getWorkingStatusDisplay(status: WorkingStatus | undefined, isTyping: boolean): { text: string; className: string } {
  // Infer working status from typing state if not explicitly set
  if (isTyping) {
    return { text: 'WORKING', className: 'working-status-working' }
  }
  switch (status) {
    case 'working': return { text: 'WORKING', className: 'working-status-working' }
    case 'busy': return { text: 'BUSY', className: 'working-status-busy' }
    case 'standby': return { text: 'STANDBY', className: 'working-status-standby' }
    case 'offline': return { text: 'OFFLINE', className: 'working-status-offline' }
    default: return { text: 'STANDBY', className: 'working-status-standby' }
  }
}

function getConnectionStatusIcon(status: GatewayConfig['status']): string {
  switch (status) {
    case 'connected': return '●'
    case 'connecting': return '◐'
    case 'disconnected': return '○'
    case 'error': return '✕'
    default: return '?'
  }
}

function getConnectionStatusClass(status: GatewayConfig['status']): string {
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
    let unassigned = 0
    for (const session of sessions) {
      if (isOpsSession(session)) continue
      if (session.gatewayId) {
        counts[session.gatewayId] = (counts[session.gatewayId] || 0) + 1
      } else {
        unassigned++
      }
    }
    // If there are unassigned sessions and only one gateway, assign them to it
    if (unassigned > 0 && gateways.length === 1) {
      counts[gateways[0].id] = (counts[gateways[0].id] || 0) + unassigned
    }
    // If multiple gateways, assign unassigned to the first connected one
    else if (unassigned > 0) {
      const firstConnected = gateways.find(g => g.status === 'connected')
      if (firstConnected) {
        counts[firstConnected.id] = (counts[firstConnected.id] || 0) + unassigned
      }
    }
    return counts
  }, [sessions, gateways])
  
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
          const isTyping = activeCount > 0
          const workingStatus = getWorkingStatusDisplay(gateway.workingStatus, isTyping)

          return (
            <div
              key={gateway.id}
              className={`agent-item ${selectedGatewayId === gateway.id ? 'agent-item-active' : ''} ${gateway.status !== 'connected' ? 'agent-item-disabled' : ''}`}
              onClick={() => gateway.status === 'connected' && onSelectGateway(gateway.id)}
              title={gateway.description || gateway.error || gateway.url}
            >
              <div className="agent-avatar" style={{ borderColor: color }}>
                <span className="agent-avatar-emoji">{gateway.avatar || gateway.name.charAt(0).toUpperCase()}</span>
                <span className={`agent-status-dot ${getConnectionStatusClass(gateway.status)}`}>
                  {getConnectionStatusIcon(gateway.status)}
                </span>
              </div>
              <div className="agent-info">
                <div className="agent-name-row">
                  <span className="agent-name">{gateway.name}</span>
                  {gateway.role && <span className="agent-role-tag">{gateway.role}</span>}
                </div>
                <div className="agent-meta">
                  {gateway.status === 'connected' ? (
                    <>
                      <span className={`agent-working-status ${workingStatus.className}`}>
                        ● {workingStatus.text}
                      </span>
                      {sessionCount > 0 && (
                        <span className="agent-session-count"> • {sessionCount}</span>
                      )}
                    </>
                  ) : gateway.status === 'connecting' ? (
                    <span className="agent-working-status working-status-connecting">◐ CONNECTING</span>
                  ) : gateway.status === 'error' ? (
                    <span className="agent-working-status working-status-error">✕ ERROR</span>
                  ) : (
                    <span className="agent-working-status working-status-offline">○ OFFLINE</span>
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
