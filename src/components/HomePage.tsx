import { motion } from 'framer-motion'
import { GlassCard, StatusCard, LiveIndicator } from './GlassCard'
import type { GatewayConfig, Task, ActivityEvent } from '../types'

interface HomePageProps {
  gateways: GatewayConfig[]
  tasks: Task[]
  events: ActivityEvent[]
  sessionCount: number
}

export function HomePage({ gateways, tasks, events, sessionCount }: HomePageProps) {
  const connectedCount = gateways.filter(g => g.status === 'connected').length
  const activeTasks = tasks.filter(t => t.status !== 'done').length
  const recentEvents = events.slice(0, 5)

  // Calculate system health metrics
  const gatewayHealth = gateways.length > 0 
    ? Math.round((connectedCount / gateways.length) * 100) 
    : 0

  const healthStatus = gatewayHealth >= 80 ? 'healthy' : gatewayHealth >= 50 ? 'warning' : 'critical'

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1 className="home-title">Mission Control</h1>
          <p className="home-subtitle">System overview and real-time metrics</p>
        </div>
        <LiveIndicator interval="15S" />
      </div>

      <div className="stats-grid">
        <StatusCard
          title="System Health"
          value={`${gatewayHealth}%`}
          subtitle={`${connectedCount} of ${gateways.length} agents online`}
          status={healthStatus}
          icon="◉"
          trend="stable"
          trendValue="Nominal"
        />

        <StatusCard
          title="Active Agents"
          value={connectedCount}
          subtitle={`${gateways.length} total configured`}
          status={connectedCount > 0 ? 'healthy' : 'critical'}
          icon="◆"
          trend={connectedCount > 0 ? 'up' : 'stable'}
        />

        <StatusCard
          title="Active Tasks"
          value={activeTasks}
          subtitle={`${tasks.length} total tasks`}
          status={activeTasks > 5 ? 'warning' : activeTasks > 0 ? 'healthy' : 'neutral'}
          icon="◊"
        />

        <StatusCard
          title="Sessions"
          value={sessionCount}
          subtitle="Active transmissions"
          status="neutral"
          icon="○"
        />

        <StatusCard
          title="Recent Activity"
          value={events.length}
          subtitle="Events in last 24h"
          status="neutral"
          icon="⚡"
          trend={events.length > 0 ? 'up' : 'stable'}
        />

        <StatusCard
          title="Network"
          value="STABLE"
          subtitle="Latency: 12ms"
          status="healthy"
          icon="◈"
          trend="stable"
          trendValue="Optimal"
        />
      </div>

      <div className="home-sections">
        <GlassCard className="home-section">
          <div className="section-header">
            <h3 className="section-title">Recent Events</h3>
            <button className="section-action">View All →</button>
          </div>
          <div className="events-list">
            {recentEvents.length === 0 ? (
              <div className="empty-state">No recent activity</div>
            ) : (
              recentEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  className="event-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className="event-type">{event.type}</span>
                  <span className="event-summary">{event.summary}</span>
                  <span className="event-time">
                    {new Date(event.timestamp).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard className="home-section">
          <div className="section-header">
            <h3 className="section-title">Agent Status</h3>
            <button className="section-action">Manage →</button>
          </div>
          <div className="agent-list">
            {gateways.length === 0 ? (
              <div className="empty-state">No agents configured</div>
            ) : (
              gateways.map((gateway, i) => (
                <motion.div
                  key={gateway.id}
                  className="agent-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className={`agent-status-dot ${gateway.status}`} />
                  <span className="agent-name">{gateway.name}</span>
                  <span className={`agent-status ${gateway.status}`}>
                    {gateway.status.toUpperCase()}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard className="home-section wide">
          <div className="section-header">
            <h3 className="section-title">Quick Stats</h3>
          </div>
          <div className="quick-stats">
            <div className="quick-stat">
              <span className="quick-stat-value">{tasks.filter(t => t.status === 'in_progress').length}</span>
              <span className="quick-stat-label">In Progress</span>
            </div>
            <div className="quick-stat">
              <span className="quick-stat-value">{tasks.filter(t => t.status === 'review').length}</span>
              <span className="quick-stat-label">In Review</span>
            </div>
            <div className="quick-stat">
              <span className="quick-stat-value">{tasks.filter(t => t.status === 'done').length}</span>
              <span className="quick-stat-label">Completed</span>
            </div>
            <div className="quick-stat">
              <span className="quick-stat-value">{tasks.filter(t => !t.assignedAgentId).length}</span>
              <span className="quick-stat-label">Unassigned</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
