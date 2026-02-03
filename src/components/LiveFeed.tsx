import { useState, useMemo, useRef, useEffect } from 'react'
import type { ActivityEvent, GatewayConfig } from '../types'
import './LiveFeed.css'

interface LiveFeedProps {
  events: ActivityEvent[]
  gateways: GatewayConfig[]
  onJumpToSource?: (event: ActivityEvent) => void
}

function getEventIcon(type: ActivityEvent['type']): string {
  switch (type) {
    case 'message': return '💬'
    case 'task_complete': return '✅'
    case 'task_start': return '🚀'
    case 'error': return '⚠️'
    case 'status_change': return '🔄'
    default: return '•'
  }
}

function getEventTypeClass(type: ActivityEvent['type']): string {
  switch (type) {
    case 'message': return 'event-message'
    case 'task_complete': return 'event-complete'
    case 'task_start': return 'event-start'
    case 'error': return 'event-error'
    case 'status_change': return 'event-status'
    default: return ''
  }
}

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getAgentColor(agentId: string, gateways: GatewayConfig[]): string {
  const colors = ['#00ff9d', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#06b6d4', '#f97316']
  const index = gateways.findIndex(g => g.id === agentId)
  return colors[index >= 0 ? index % colors.length : 0]
}

export function LiveFeed({ events, gateways, onJumpToSource }: LiveFeedProps) {
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  
  // Filter events by selected agent
  const filteredEvents = useMemo(() => {
    if (!filterAgentId) return events
    return events.filter(e => e.agentId === filterAgentId)
  }, [events, filterAgentId])
  
  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [filteredEvents, autoScroll])
  
  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!feedRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }
  
  return (
    <div className="live-feed">
      <div className="live-feed-header">
        <span className="live-feed-title">LIVE FEED</span>
        <span className="live-feed-count">{filteredEvents.length}</span>
      </div>
      
      {/* Agent filter tabs */}
      <div className="live-feed-filters">
        <button
          className={`feed-filter-btn ${filterAgentId === null ? 'active' : ''}`}
          onClick={() => setFilterAgentId(null)}
        >
          All
        </button>
        {gateways.filter(g => g.status === 'connected').map(gateway => (
          <button
            key={gateway.id}
            className={`feed-filter-btn ${filterAgentId === gateway.id ? 'active' : ''}`}
            onClick={() => setFilterAgentId(gateway.id)}
            style={{ 
              borderColor: filterAgentId === gateway.id ? getAgentColor(gateway.id, gateways) : undefined 
            }}
          >
            {gateway.avatar || gateway.name.charAt(0)}
          </button>
        ))}
      </div>
      
      {/* Event list */}
      <div 
        className="live-feed-list" 
        ref={feedRef}
        onScroll={handleScroll}
      >
        {filteredEvents.length === 0 ? (
          <div className="live-feed-empty">
            <div className="feed-empty-icon">📡</div>
            <div className="feed-empty-text">No activity yet</div>
            <div className="feed-empty-hint">Events will appear as agents respond</div>
          </div>
        ) : (
          filteredEvents.map(event => {
            const agentColor = getAgentColor(event.agentId, gateways)
            const gateway = gateways.find(g => g.id === event.agentId)
            
            return (
              <div 
                key={event.id}
                className={`feed-event ${getEventTypeClass(event.type)}`}
                onClick={() => onJumpToSource?.(event)}
              >
                <div className="feed-event-icon">{getEventIcon(event.type)}</div>
                <div className="feed-event-content">
                  <div className="feed-event-header">
                    <span 
                      className="feed-event-agent"
                      style={{ color: agentColor }}
                    >
                      {gateway?.avatar || '🤖'} {event.agentName}
                    </span>
                    <span className="feed-event-time">{formatTime(event.timestamp)}</span>
                  </div>
                  <div className="feed-event-summary">{event.summary}</div>
                  {event.details && (
                    <div className="feed-event-details">{event.details}</div>
                  )}
                  {event.source && (
                    <div className="feed-event-source">
                      <span className="feed-source-icon">→</span>
                      {event.source}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      
      {/* Auto-scroll indicator */}
      {!autoScroll && filteredEvents.length > 0 && (
        <button 
          className="feed-scroll-btn"
          onClick={() => {
            setAutoScroll(true)
            if (feedRef.current) {
              feedRef.current.scrollTop = feedRef.current.scrollHeight
            }
          }}
        >
          ↓ New events
        </button>
      )}
    </div>
  )
}
