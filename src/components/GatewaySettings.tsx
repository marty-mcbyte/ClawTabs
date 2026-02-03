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
}

export function GatewaySettings({
  isOpen,
  onClose,
  gateways,
  onAddGateway,
  onRemoveGateway,
  onConnect,
  onDisconnect,
  onTestConnection,
  onRenameGateway
}: GatewaySettingsProps) {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newToken, setNewToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  
  const handleStartEdit = (gateway: GatewayConfig) => {
    setEditingId(gateway.id)
    setEditName(gateway.name)
  }
  
  const handleSaveEdit = async () => {
    if (editingId && editName.trim() && onRenameGateway) {
      await onRenameGateway(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  const resetForm = useCallback(() => {
    setNewName('')
    setNewUrl('')
    setNewToken('')
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
        addedAt: Date.now()
      }
      await onAddGateway(config)
      resetForm()
    } catch (err) {
      console.error('Failed to add gateway:', err)
    } finally {
      setAdding(false)
    }
  }, [newName, newUrl, newToken, onAddGateway, resetForm, gateways.length])

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
                  className={`gateway-item ${gateway.status}`}
                >
                  <div className={`gateway-status-indicator ${gateway.status}`} />
                  <div className="gateway-info">
                    {editingId === gateway.id ? (
                      <input
                        className="gateway-name-edit"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit()
                          if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="gateway-name" 
                        onClick={() => handleStartEdit(gateway)}
                        title="Click to rename"
                      >
                        {gateway.name}
                        <span className="gateway-edit-icon">✏</span>
                      </div>
                    )}
                    <div className="gateway-url">{gateway.url}</div>
                    {gateway.error && (
                      <div className="gateway-error-msg">{gateway.error}</div>
                    )}
                  </div>
                  <div className="gateway-actions">
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
              ))
            )}
          </div>

          {/* Add Gateway Form */}
          <div className="gateway-add-section">
            <h3>Add Gateway</h3>
            <div className="gateway-form">
              <div className="gateway-form-row">
                <label>Name (optional)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My Agent"
                />
              </div>
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
