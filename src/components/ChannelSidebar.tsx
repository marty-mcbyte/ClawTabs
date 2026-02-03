import { useState } from 'react'
import type { Channel, GatewayConfig } from '../types'
import './ChannelSidebar.css'

interface ChannelSidebarProps {
  channels: Channel[]
  activeChannelId: string | null
  gateways: GatewayConfig[]
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onBackToSessions: () => void
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  gateways,
  onSelect,
  onCreate,
  onDelete,
  onBackToSessions
}: ChannelSidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000)
    }
  }

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header">
        <button className="channel-back-btn" onClick={onBackToSessions}>
          ← Sessions
        </button>
      </div>

      <div className="channel-sidebar-title">
        <span>CHANNELS</span>
        <span className="channel-count">[{channels.length}]</span>
      </div>

      <button className="channel-create-btn" onClick={onCreate}>
        + Create Channel
      </button>

      <div className="channel-list">
        {channels.length === 0 ? (
          <div className="channel-list-empty">
            No channels yet. Create one to coordinate your agents!
          </div>
        ) : (
          channels.map(channel => {
            const memberCount = channel.memberAgentIds.length
            const connectedMembers = channel.memberAgentIds.filter(id => 
              gateways.find(g => g.id === id)?.status === 'connected'
            ).length

            return (
              <div
                key={channel.id}
                className={`channel-item ${activeChannelId === channel.id ? 'channel-item-active' : ''}`}
                onClick={() => onSelect(channel.id)}
              >
                <div className="channel-item-info">
                  <div className="channel-item-name">
                    <span className="channel-item-hash">#</span>
                    {channel.name}
                  </div>
                  <div className="channel-item-meta">
                    {connectedMembers}/{memberCount} agents online
                  </div>
                </div>
                <button
                  className={`channel-delete-btn ${confirmDeleteId === channel.id ? 'confirm' : ''}`}
                  onClick={(e) => handleDelete(channel.id, e)}
                  title={confirmDeleteId === channel.id ? 'Click again to confirm' : 'Delete channel'}
                >
                  {confirmDeleteId === channel.id ? '✕' : '🗑'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
