import { useState, useCallback } from 'react'
import type { Channel, GatewayConfig } from '../types'
import { generateId } from '../store/db'
import './ChannelModal.css'

interface ChannelModalProps {
  isOpen: boolean
  onClose: () => void
  gateways: GatewayConfig[]
  onCreateChannel: (channel: Channel) => void
  editingChannel?: Channel | null
  onUpdateChannel?: (channel: Channel) => void
}

// Generate consistent color for gateway ID
function getAgentColor(index: number): string {
  const colors = ['#00ff9d', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#06b6d4', '#f97316']
  return colors[index % colors.length]
}

export function ChannelModal({
  isOpen,
  onClose,
  gateways,
  onCreateChannel,
  editingChannel,
  onUpdateChannel
}: ChannelModalProps) {
  const [name, setName] = useState(editingChannel?.name || '')
  const [description, setDescription] = useState(editingChannel?.description || '')
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(
    new Set(editingChannel?.memberAgentIds || [])
  )

  const isEditing = !!editingChannel

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return
    if (selectedAgents.size === 0) return

    const channel: Channel = {
      id: editingChannel?.id || generateId(),
      name: name.trim(),
      description: description.trim(),
      memberAgentIds: Array.from(selectedAgents),
      createdAt: editingChannel?.createdAt || Date.now()
    }

    if (isEditing && onUpdateChannel) {
      onUpdateChannel(channel)
    } else {
      onCreateChannel(channel)
    }

    // Reset form
    setName('')
    setDescription('')
    setSelectedAgents(new Set())
    onClose()
  }, [name, description, selectedAgents, editingChannel, isEditing, onCreateChannel, onUpdateChannel, onClose])

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const connectedGateways = gateways.filter(g => g.status === 'connected')

  return (
    <div className="channel-modal-overlay" onClick={handleOverlayClick}>
      <div className="channel-modal">
        <div className="channel-modal-header">
          <h2>{isEditing ? 'Edit Channel' : 'Create Channel'}</h2>
          <button className="channel-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="channel-modal-content">
          <div className="channel-modal-field">
            <label>Channel Name</label>
            <div className="channel-name-input-wrapper">
              <span className="channel-name-hash">#</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="general"
                maxLength={32}
              />
            </div>
          </div>

          <div className="channel-modal-field">
            <label>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              maxLength={100}
            />
          </div>

          <div className="channel-modal-field">
            <label>Member Agents</label>
            <div className="channel-modal-hint">
              Select which agents can participate in this channel
            </div>
            
            {connectedGateways.length === 0 ? (
              <div className="channel-modal-no-agents">
                No connected agents. Connect to at least one gateway first.
              </div>
            ) : (
              <div className="channel-agent-list">
                {connectedGateways.map((gateway, index) => {
                  const color = getAgentColor(index)
                  const isSelected = selectedAgents.has(gateway.id)
                  
                  return (
                    <div
                      key={gateway.id}
                      className={`channel-agent-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleAgent(gateway.id)}
                    >
                      <div 
                        className="channel-agent-avatar"
                        style={{ borderColor: isSelected ? color : 'var(--border)' }}
                      >
                        <span style={{ color }}>{gateway.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="channel-agent-info">
                        <div className="channel-agent-name">{gateway.name}</div>
                        <div className="channel-agent-url">{new URL(gateway.url).hostname}</div>
                      </div>
                      <div className={`channel-agent-check ${isSelected ? 'checked' : ''}`}>
                        {isSelected ? '✓' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="channel-modal-footer">
          <button className="channel-modal-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="channel-modal-btn primary"
            onClick={handleSubmit}
            disabled={!name.trim() || selectedAgents.size === 0}
          >
            {isEditing ? 'Save Changes' : 'Create Channel'}
          </button>
        </div>
      </div>
    </div>
  )
}
