import { useState, useCallback } from 'react'
import type { GatewayConfig } from '../types'
import { generateId } from '../store/db'
import './GatewaySettings.css'

interface GatewaySettingsProps {
  isOpen: boolean
  onClose: () => void
  gateways: GatewayConfig[]
  onAddGateway: (config: GatewayConfig) => Promise<void>
  onRemoveGateway: (id: string) => Promise<void>
  onConnect: (id: string) => Promise<void>
  onDisconnect: (id: string) => Promise<void>
  onTestConnection: (url: string, token: string) => Promise<{ success: boolean; error?: string }>
  onRenameGateway?: (id: string, name: string) => Promise<void>
  onUpdateGateway?: (id: string, updates: Partial<GatewayConfig>) => Promise<void>
}

// Role presets for quick selection
const ROLE_PRESETS = ['Dev', 'Research', 'Content', 'Finance', 'Support', 'Ops', 'Creative']
const AVATAR_PRESETS = ['🤖', '🧠', '⚡', '🔧', '📊', '🎨', '🔬', '💼', '🛡️', '🚀']

export function GatewaySettings({
  isOpen,
  onClose,
  gateways,
  onAddGateway,
  onRemoveGateway,
  onConnect,
  onDisconnect,
  onTestConnection,
  onRenameGateway,
  onUpdateGateway
}: GatewaySettingsProps) {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newToken, setNewToken] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAvatar, setNewAvatar] = useState('🤖')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  const handleStartEdit = (gateway: GatewayConfig) => {
    setEditingId(gateway.id)
    setEditName(gateway.name)
    setEditRole(gateway.role || '')
    setEditDescription(gateway.description || '')
    setEditAvatar(gateway.avatar || '🤖')
    setExpandedId(gateway.id)
  }
  
  const resetForm = useCallback(() => {
    setNewName('')
    setNewUrl('')
    setNewToken('')
    setNewRole('')
    setNewDescription('')
    setNewAvatar('🤖')
    setTestResult(null)
    setTesting(false)
    setAdding(false)
  }, [])

  const handleTest = useCallback(async () => {
    if (!newUrl || !newToken) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTestConnection(newUrl, newToken)
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, error: String(err) })
    } finally {
      setTesting(false)
    }
  }, [newUrl, newToken, onTestConnection])

  const handleAdd = useCallback(async () => {
    if (!newUrl || !newToken) return
    setAdding(true)
    try {
      // Generate a friendly default name if not provided
      let defaultName = newName
      if (!defaultName) {
        const agentNum = gateways.length + 1
        defaultName = `Agent ${agentNum}`
      }
      const config: GatewayConfig = {
        id: generateId(),
        name: defaultName,
        url: newUrl,
        token: newToken,
        status: 'disconnected',
        addedAt: Date.now(),
        role: newRole || undefined,
        description: newDescription || undefined,
        avatar: newAvatar || '🤖',
        workingStatus: 'offline'
      }
      await onAddGateway(config)
      resetForm()
    } catch (err) {
      console.error('Failed to add gateway:', err)
    } finally {
      setAdding(false)
    }
  }, [newName, newUrl, newToken, newRole, newDescription, newAvatar, onAddGateway, resetForm, gateways.length])

  const handleSaveProfile = useCallback(async () => {
    if (!editingId) return
    if (onUpdateGateway) {
      await onUpdateGateway(editingId, {
        name: editName.trim() || undefined,
        role: editRole || undefined,
        description: editDescription || undefined,
        avatar: editAvatar || '🤖'
      })
    } else if (onRenameGateway && editName.trim()) {
      await onRenameGateway(editingId, editName.trim())
    }
    setEditingId(null)
    setExpandedId(null)
  }, [editingId, editName, editRole, editDescription, editAvatar, onUpdateGateway, onRenameGateway])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="gateway-settings-overlay" onClick={handleOverlayClick}>
      <div className="gateway-settings-modal">
        <div className="gateway-settings-header">
          <h2>Gateway Connections</h2>
          <button className="gateway-settings-close" onClick={onClose}>×</button>
        </div>
        
        <div className="gateway-settings-content">
          {/* Gateway List */}
          <div className="gateway-list">
            {gateways.length === 0 ? (
              <div className="gateway-list-empty">
                No gateways configured. Add one below to connect to an OpenClaw agent.
              </div>
            ) : (
              gateways.map(gateway => (
                <div 
                  key={gateway.id} 
                  className={`gateway-item ${gateway.status} ${expandedId === gateway.id ? 'expanded' : ''}`}
                >
                  <div className="gateway-item-main">
                    <div className={`gateway-status-indicator ${gateway.status}`} />
                    <div className="gateway-avatar-display" onClick={() => setExpandedId(expandedId === gateway.id ? null : gateway.id)}>
                      {gateway.avatar || '🤖'}
                    </div>
                    <div className="gateway-info">
                      <div className="gateway-name-row">
                        <span className="gateway-name">{gateway.name}</span>
                        {gateway.role && <span className="gateway-role-badge">{gateway.role}</span>}
                      </div>
                      <div className="gateway-url">{gateway.url}</div>
                      {gateway.error && (
                        <div className="gateway-error-msg">{gateway.error}</div>
                      )}
                    </div>
                    <div className="gateway-actions">
                      <button
                        className="gateway-action-btn icon"
                        onClick={() => setExpandedId(expandedId === gateway.id ? null : gateway.id)}
                        title="Edit profile"
                      >
                        ✏
                      </button>
                      {gateway.status === 'connected' ? (
                        <button 
                          className="gateway-action-btn"
                          onClick={() => onDisconnect(gateway.id)}
                        >
                          Disconnect
                        </button>
                      ) : gateway.status === 'connecting' ? (
                        <button className="gateway-action-btn" disabled>
                          Connecting...
                        </button>
                      ) : (
                        <button 
                          className="gateway-action-btn primary"
                          onClick={() => onConnect(gateway.id)}
                        >
                          Connect
                        </button>
                      )}
                      <button 
                        className="gateway-action-btn danger"
                        onClick={() => onRemoveGateway(gateway.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded profile editor */}
                  {expandedId === gateway.id && (
                    <div className="gateway-profile-editor">
                      <div className="profile-row">
                        <label>Name</label>
                        <input
                          type="text"
                          value={editingId === gateway.id ? editName : gateway.name}
                          onChange={e => { setEditingId(gateway.id); setEditName(e.target.value) }}
                          onFocus={() => {
                            if (editingId !== gateway.id) {
                              handleStartEdit(gateway)
                            }
                          }}
                          placeholder="Agent name"
                        />
                      </div>
                      <div className="profile-row">
                        <label>Role</label>
                        <div className="role-selector">
                          <input
                            type="text"
                            value={editingId === gateway.id ? editRole : (gateway.role || '')}
                            onChange={e => { setEditingId(gateway.id); setEditRole(e.target.value) }}
                            onFocus={() => {
                              if (editingId !== gateway.id) handleStartEdit(gateway)
                            }}
                            placeholder="Dev, Research, etc."
                          />
                          <div className="role-presets">
                            {ROLE_PRESETS.map(role => (
                              <button
                                key={role}
                                className={`role-preset ${(editingId === gateway.id ? editRole : gateway.role) === role ? 'active' : ''}`}
                                onClick={() => { setEditingId(gateway.id); setEditRole(role) }}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="profile-row">
                        <label>Avatar</label>
                        <div className="avatar-selector">
                          {AVATAR_PRESETS.map(emoji => (
                            <button
                              key={emoji}
                              className={`avatar-preset ${(editingId === gateway.id ? editAvatar : gateway.avatar) === emoji ? 'active' : ''}`}
                              onClick={() => { setEditingId(gateway.id); setEditAvatar(emoji) }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="profile-row">
                        <label>Description</label>
                        <textarea
                          value={editingId === gateway.id ? editDescription : (gateway.description || '')}
                          onChange={e => { setEditingId(gateway.id); setEditDescription(e.target.value) }}
                          onFocus={() => {
                            if (editingId !== gateway.id) handleStartEdit(gateway)
                          }}
                          placeholder="What does this agent do?"
                          rows={2}
                        />
                      </div>
                      {editingId === gateway.id && (
                        <div className="profile-actions">
                          <button className="gateway-action-btn" onClick={() => { setEditingId(null); setExpandedId(null) }}>
                            Cancel
                          </button>
                          <button className="gateway-action-btn primary" onClick={handleSaveProfile}>
                            Save Profile
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Gateway Form */}
          <div className="gateway-add-section">
            <h3>Add Gateway</h3>
            <div className="gateway-form">
              <div className="gateway-form-row">
                <label>Gateway URL</label>
                <input
                  type="text"
                  className="mono"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="ws://localhost:18789"
                />
              </div>
              <div className="gateway-form-row">
                <label>Token</label>
                <input
                  type="password"
                  className="mono"
                  value={newToken}
                  onChange={e => setNewToken(e.target.value)}
                  placeholder="Gateway authentication token"
                />
              </div>

              {testResult && (
                <div className={`gateway-test-result ${testResult.success ? 'success' : 'error'}`}>
                  {testResult.success ? '✓ Connection successful!' : `✗ ${testResult.error || 'Connection failed'}`}
                </div>
              )}

              {testing && (
                <div className="gateway-test-result testing">
                  Testing connection...
                </div>
              )}

              <div className="gateway-form-divider">Agent Profile</div>
              
              <div className="gateway-form-row">
                <label>Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My Agent"
                />
              </div>
              <div className="gateway-form-row">
                <label>Role</label>
                <div className="role-selector">
                  <input
                    type="text"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    placeholder="Dev, Research, etc."
                  />
                  <div className="role-presets">
                    {ROLE_PRESETS.map(role => (
                      <button
                        key={role}
                        type="button"
                        className={`role-preset ${newRole === role ? 'active' : ''}`}
                        onClick={() => setNewRole(role)}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="gateway-form-row">
                <label>Avatar</label>
                <div className="avatar-selector">
                  {AVATAR_PRESETS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className={`avatar-preset ${newAvatar === emoji ? 'active' : ''}`}
                      onClick={() => setNewAvatar(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="gateway-form-row">
                <label>Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="What does this agent do?"
                  rows={2}
                />
              </div>

              <div className="gateway-form-actions">
                <button
                  className="gateway-form-btn"
                  onClick={handleTest}
                  disabled={!newUrl || !newToken || testing || adding}
                >
                  Test
                </button>
                <button
                  className="gateway-form-btn primary"
                  onClick={handleAdd}
                  disabled={!newUrl || !newToken || testing || adding}
                >
                  {adding ? 'Adding...' : 'Add Gateway'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
