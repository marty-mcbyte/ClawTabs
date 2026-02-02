import { useState, useEffect } from 'react'
import type { Session } from '../types'
import type { ConnectionStatus } from '../gateway'

interface OpsPanelProps {
  sessions: Session[]
  allSessions: Session[]
  connStatus: ConnectionStatus
  gatewayUrl: string
  onSelectSession: (id: string) => void
}

export function OpsPanel({ sessions, allSessions, connStatus, gatewayUrl, onSelectSession }: OpsPanelProps) {
  const [uptime, setUptime] = useState(0)
  const [expandedSection, setExpandedSection] = useState<string | null>('status')

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => setUptime(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const totalMessages = allSessions.reduce((acc, s) => acc + s.messages.length, 0)
  const activeSessions = allSessions.filter(s => s.isTyping).length
  const chatSessions = allSessions.length - sessions.length
  const systemMessages = allSessions.flatMap(s =>
    s.messages.filter(m => m.role === 'system').map(m => ({ ...m, sessionName: s.name, sessionId: s.id }))
  ).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)

  const toggle = (section: string) => setExpandedSection(prev => prev === section ? null : section)

  const statusColor = connStatus === 'connected' ? 'var(--accent)' : connStatus === 'connecting' ? '#f0ad4e' : '#ff6b6b'
  const statusLabel = connStatus === 'connected' ? 'ONLINE' : connStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'

  return (
    <div className="ops-panel">
      <div className="ops-header">
        <span className="ops-header-dot">◆</span>
        <span className="ops-header-title">OPERATIONS DASHBOARD</span>
        <span className="ops-header-uptime">UPTIME {formatUptime(uptime)}</span>
      </div>

      <div className="ops-content">
        {/* Stats Bar */}
        <div className="ops-stats-bar">
          <div className="ops-stat">
            <div className="ops-stat-value" style={{ color: 'var(--accent)' }}>{allSessions.length}</div>
            <div className="ops-stat-label">TOTAL</div>
          </div>
          <div className="ops-stat">
            <div className="ops-stat-value" style={{ color: '#5bc0de' }}>{chatSessions}</div>
            <div className="ops-stat-label">CHAT</div>
          </div>
          <div className="ops-stat">
            <div className="ops-stat-value" style={{ color: '#f0ad4e' }}>{sessions.length}</div>
            <div className="ops-stat-label">OPS</div>
          </div>
          <div className="ops-stat">
            <div className="ops-stat-value" style={{ color: activeSessions > 0 ? '#2dd4a8' : 'var(--text-dim)' }}>{activeSessions}</div>
            <div className="ops-stat-label">ACTIVE</div>
          </div>
          <div className="ops-stat">
            <div className="ops-stat-value">{totalMessages}</div>
            <div className="ops-stat-label">MESSAGES</div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="ops-section" onClick={() => toggle('status')}>
          <div className="ops-section-header">
            <span className="ops-section-arrow">{expandedSection === 'status' ? '▾' : '▸'}</span>
            <span className="ops-section-icon" style={{ color: statusColor }}>◉</span>
            <span>CONNECTION STATUS</span>
            <span className="ops-section-badge" style={{ color: statusColor, borderColor: statusColor }}>{statusLabel}</span>
          </div>
        </div>
        {expandedSection === 'status' && (
          <div className="ops-section-body">
            <div className="ops-kv"><span className="ops-key">GATEWAY</span><span className="ops-val">{gatewayUrl}</span></div>
            <div className="ops-kv"><span className="ops-key">PROTOCOL</span><span className="ops-val">v3 WebSocket</span></div>
            <div className="ops-kv"><span className="ops-key">CLIENT</span><span className="ops-val">ClawTabs/0.2.0</span></div>
            <div className="ops-kv"><span className="ops-key">STATUS</span><span className="ops-val" style={{ color: statusColor }}>{statusLabel}</span></div>
            <div className="ops-kv"><span className="ops-key">UPTIME</span><span className="ops-val">{formatUptime(uptime)}</span></div>
          </div>
        )}

        {/* Sub-agent Sessions */}
        <div className="ops-section" onClick={() => toggle('agents')}>
          <div className="ops-section-header">
            <span className="ops-section-arrow">{expandedSection === 'agents' ? '▾' : '▸'}</span>
            <span className="ops-section-icon" style={{ color: '#f0ad4e' }}>⬡</span>
            <span>SUB-AGENTS / OPS SESSIONS</span>
            <span className="ops-section-badge" style={{ color: '#f0ad4e', borderColor: '#f0ad4e' }}>{sessions.length}</span>
          </div>
        </div>
        {expandedSection === 'agents' && (
          <div className="ops-section-body">
            {sessions.length === 0 ? (
              <div className="ops-empty">No sub-agent sessions detected</div>
            ) : (
              sessions.map(s => {
                const lastMsg = s.messages[s.messages.length - 1]
                return (
                  <div key={s.id} className="ops-agent-item" onClick={() => onSelectSession(s.id)}>
                    <div className="ops-agent-header">
                      <span className={`ops-agent-status ${s.isTyping ? 'ops-agent-active' : ''}`}>
                        {s.isTyping ? '◉' : '○'}
                      </span>
                      <span className="ops-agent-name">{s.name}</span>
                      <span className="ops-agent-id">{s.id.substring(0, 12)}</span>
                    </div>
                    <div className="ops-agent-detail">
                      <span className="ops-agent-msgs">{s.messages.length} msgs</span>
                      {lastMsg && (
                        <span className="ops-agent-last">
                          {lastMsg.content.substring(0, 80)}{lastMsg.content.length > 80 ? '…' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* System Events */}
        <div className="ops-section" onClick={() => toggle('events')}>
          <div className="ops-section-header">
            <span className="ops-section-arrow">{expandedSection === 'events' ? '▾' : '▸'}</span>
            <span className="ops-section-icon" style={{ color: '#ff6b6b' }}>⚡</span>
            <span>SYSTEM EVENTS</span>
            <span className="ops-section-badge" style={{ color: '#ff6b6b', borderColor: '#ff6b6b' }}>{systemMessages.length}</span>
          </div>
        </div>
        {expandedSection === 'events' && (
          <div className="ops-section-body">
            {systemMessages.length === 0 ? (
              <div className="ops-empty">No system events recorded</div>
            ) : (
              systemMessages.map((m, i) => (
                <div key={m.id + i} className="ops-event-item">
                  <span className="ops-event-time">
                    {new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </span>
                  <span className="ops-event-session">[{m.sessionName}]</span>
                  <span className="ops-event-msg">{m.content}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* All Sessions Overview */}
        <div className="ops-section" onClick={() => toggle('all')}>
          <div className="ops-section-header">
            <span className="ops-section-arrow">{expandedSection === 'all' ? '▾' : '▸'}</span>
            <span className="ops-section-icon" style={{ color: '#5bc0de' }}>▣</span>
            <span>ALL SESSIONS</span>
            <span className="ops-section-badge" style={{ color: '#5bc0de', borderColor: '#5bc0de' }}>{allSessions.length}</span>
          </div>
        </div>
        {expandedSection === 'all' && (
          <div className="ops-section-body">
            <div className="ops-sessions-table">
              <div className="ops-table-header">
                <span className="ops-th" style={{ flex: 0.5 }}>ST</span>
                <span className="ops-th" style={{ flex: 2 }}>NAME</span>
                <span className="ops-th" style={{ flex: 1.5 }}>ID</span>
                <span className="ops-th" style={{ flex: 0.5 }}>MSGS</span>
                <span className="ops-th" style={{ flex: 1 }}>TYPE</span>
              </div>
              {allSessions.map(s => {
                const isOps = sessions.some(os => os.id === s.id)
                return (
                  <div key={s.id} className="ops-table-row" onClick={() => onSelectSession(s.id)}>
                    <span className="ops-td" style={{ flex: 0.5, color: s.isTyping ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {s.isTyping ? '◉' : '○'}
                    </span>
                    <span className="ops-td ops-td-name" style={{ flex: 2 }}>{s.name}</span>
                    <span className="ops-td" style={{ flex: 1.5, color: 'var(--text-dim)' }}>{s.id.substring(0, 16)}</span>
                    <span className="ops-td" style={{ flex: 0.5 }}>{s.messages.length}</span>
                    <span className="ops-td" style={{ flex: 1, color: isOps ? '#f0ad4e' : '#5bc0de' }}>
                      {isOps ? 'OPS' : 'CHAT'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
