// GatewayManager - Manages multiple Gateway connections
import { Gateway } from '../gateway'
import type { ConnectionStatus } from '../gateway'
import type { GatewayConfig, GatewayStatus } from '../types'
import { getAllGateways, saveGateway, updateGatewayStatus } from './db'

export type GatewayManagerEventType = 
  | 'statusChange'
  | 'chatEvent'
  | 'gatewayAdded'
  | 'gatewayRemoved'
  | 'error'

export interface GatewayManagerEvent {
  type: GatewayManagerEventType
  gatewayId: string
  payload?: any
}

export type GatewayManagerListener = (event: GatewayManagerEvent) => void

/**
 * Manages multiple gateway connections
 */
export class GatewayManager {
  private gateways: Map<string, Gateway> = new Map()
  private configs: Map<string, GatewayConfig> = new Map()
  private listeners: Set<GatewayManagerListener> = new Set()
  private initialized = false

  /**
   * Initialize the manager - loads gateways from IndexedDB
   */
  async initialize(): Promise<GatewayConfig[]> {
    if (this.initialized) {
      return Array.from(this.configs.values())
    }

    const storedGateways = await getAllGateways()
    for (const config of storedGateways) {
      // Reset status to disconnected on load
      config.status = 'disconnected'
      this.configs.set(config.id, config)
    }

    this.initialized = true
    return storedGateways
  }

  /**
   * Add a listener for gateway events
   */
  addListener(listener: GatewayManagerListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: GatewayManagerEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (e) {
        console.error('[GatewayManager] Listener error:', e)
      }
    }
  }

  /**
   * Get all gateway configs
   */
  getConfigs(): GatewayConfig[] {
    return Array.from(this.configs.values())
  }

  /**
   * Get a specific gateway config
   */
  getConfig(id: string): GatewayConfig | undefined {
    return this.configs.get(id)
  }

  /**
   * Get a specific gateway instance
   */
  getGateway(id: string): Gateway | undefined {
    return this.gateways.get(id)
  }

  /**
   * Get the first connected gateway (for backward compatibility)
   */
  getFirstConnected(): { gateway: Gateway; config: GatewayConfig } | undefined {
    for (const [id, gateway] of this.gateways) {
      if (gateway.status === 'connected') {
        const config = this.configs.get(id)
        if (config) return { gateway, config }
      }
    }
    return undefined
  }

  /**
   * Get all connected gateways
   */
  getConnected(): Array<{ gateway: Gateway; config: GatewayConfig }> {
    const result: Array<{ gateway: Gateway; config: GatewayConfig }> = []
    for (const [id, gateway] of this.gateways) {
      if (gateway.status === 'connected') {
        const config = this.configs.get(id)
        if (config) result.push({ gateway, config })
      }
    }
    return result
  }

  /**
   * Add and optionally connect a new gateway
   */
  async addGateway(config: GatewayConfig, autoConnect = true): Promise<void> {
    this.configs.set(config.id, config)
    await saveGateway(config)

    this.emit({ type: 'gatewayAdded', gatewayId: config.id, payload: config })

    if (autoConnect) {
      await this.connect(config.id)
    }
  }

  /**
   * Update gateway config (name, url, token)
   */
  async updateGateway(id: string, updates: Partial<Pick<GatewayConfig, 'name' | 'url' | 'token'>>): Promise<void> {
    const config = this.configs.get(id)
    if (!config) return

    const wasConnected = this.gateways.get(id)?.status === 'connected'
    
    // If URL or token changed and connected, reconnect
    if ((updates.url && updates.url !== config.url) || 
        (updates.token && updates.token !== config.token)) {
      if (wasConnected) {
        await this.disconnect(id)
      }
    }

    // Apply updates
    Object.assign(config, updates)
    await saveGateway(config)

    // Reconnect if was connected and credentials changed
    if (wasConnected && (updates.url || updates.token)) {
      await this.connect(id)
    }
  }

  /**
   * Remove a gateway
   */
  async removeGateway(id: string): Promise<void> {
    await this.disconnect(id)
    this.configs.delete(id)
    this.emit({ type: 'gatewayRemoved', gatewayId: id })
  }

  /**
   * Connect to a specific gateway
   */
  async connect(id: string): Promise<void> {
    const config = this.configs.get(id)
    if (!config) {
      throw new Error(`Gateway ${id} not found`)
    }

    // Already have an instance?
    let gateway = this.gateways.get(id)
    if (gateway) {
      if (gateway.status === 'connected' || gateway.status === 'connecting') {
        return // Already connected/connecting
      }
      // Disconnect old instance
      gateway.disconnect()
    }

    // Create new gateway instance
    gateway = new Gateway(config.url, config.token)
    this.gateways.set(id, gateway)

    // Update status
    this.updateStatus(id, 'connecting')

    gateway.setHandlers({
      onConnectionChange: (status: ConnectionStatus) => {
        const gwStatus: GatewayStatus = status as GatewayStatus
        this.updateStatus(id, gwStatus)
        this.emit({
          type: 'statusChange',
          gatewayId: id,
          payload: { status: gwStatus }
        })
      },
      onChatEvent: (payload: any, eventType: string) => {
        this.emit({
          type: 'chatEvent',
          gatewayId: id,
          payload: { ...payload, eventType, _gatewayId: id }
        })
      }
    })

    gateway.connect()
  }

  /**
   * Disconnect from a specific gateway
   */
  async disconnect(id: string): Promise<void> {
    const gateway = this.gateways.get(id)
    if (gateway) {
      gateway.disconnect()
      this.gateways.delete(id)
    }
    this.updateStatus(id, 'disconnected')
  }

  /**
   * Connect to all stored gateways
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.configs.keys()).map(id => 
      this.connect(id).catch(err => {
        console.error(`[GatewayManager] Failed to connect ${id}:`, err)
        this.updateStatus(id, 'error', String(err))
      })
    )
    await Promise.allSettled(promises)
  }

  /**
   * Disconnect from all gateways
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.gateways.keys()).map(id => this.disconnect(id))
    await Promise.allSettled(promises)
  }

  /**
   * Test connection to a gateway URL/token without saving
   */
  async testConnection(url: string, token: string, timeoutMs = 10000): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const testGw = new Gateway(url, token)
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          testGw.disconnect()
          resolve({ success: false, error: 'Connection timeout' })
        }
      }, timeoutMs)

      testGw.setHandlers({
        onConnectionChange: (status) => {
          if (resolved) return
          if (status === 'connected') {
            resolved = true
            clearTimeout(timeout)
            testGw.disconnect()
            resolve({ success: true })
          } else if (status === 'disconnected') {
            // Only fail if we were trying to connect
            resolved = true
            clearTimeout(timeout)
            resolve({ success: false, error: 'Connection failed' })
          }
        }
      })

      testGw.connect()
    })
  }

  private updateStatus(id: string, status: GatewayStatus, error?: string) {
    const config = this.configs.get(id)
    if (config) {
      config.status = status
      config.error = error
      if (status === 'connected') {
        config.lastConnected = Date.now()
      }
      // Persist to IndexedDB
      updateGatewayStatus(id, status, error).catch(console.error)
    }
  }

  /**
   * Route a chat message to the correct gateway based on session key
   */
  async chatSend(sessionKey: string, text: string, attachments?: any[], gatewayId?: string): Promise<any> {
    let gateway: Gateway | undefined

    if (gatewayId) {
      gateway = this.gateways.get(gatewayId)
    } else {
      // Try to find the gateway by session prefix or use first connected
      const firstConnected = this.getFirstConnected()
      gateway = firstConnected?.gateway
    }

    if (!gateway || gateway.status !== 'connected') {
      throw new Error('No connected gateway available')
    }

    return gateway.chatSend(sessionKey, text, attachments)
  }

  /**
   * List sessions from a specific gateway or all connected gateways
   */
  async listSessions(gatewayId?: string): Promise<Array<{ session: any; gatewayId: string }>> {
    const results: Array<{ session: any; gatewayId: string }> = []

    if (gatewayId) {
      const gateway = this.gateways.get(gatewayId)
      if (gateway?.status === 'connected') {
        const sessions = await gateway.listSessions()
        for (const session of sessions) {
          results.push({ session, gatewayId })
        }
      }
    } else {
      // List from all connected gateways
      for (const [id, gateway] of this.gateways) {
        if (gateway.status === 'connected') {
          try {
            const sessions = await gateway.listSessions()
            for (const session of sessions) {
              results.push({ session, gatewayId: id })
            }
          } catch (e) {
            console.error(`[GatewayManager] Failed to list sessions from ${id}:`, e)
          }
        }
      }
    }

    return results
  }

  /**
   * Get chat history from a specific gateway
   */
  async chatHistory(sessionKey: string, gatewayId: string): Promise<any[]> {
    const gateway = this.gateways.get(gatewayId)
    if (!gateway || gateway.status !== 'connected') {
      throw new Error(`Gateway ${gatewayId} not connected`)
    }
    return gateway.chatHistory(sessionKey)
  }

  /**
   * Abort a chat session
   */
  async chatAbort(sessionKey: string, gatewayId: string, runId?: string): Promise<void> {
    const gateway = this.gateways.get(gatewayId)
    if (gateway?.status === 'connected') {
      await gateway.chatAbort(sessionKey, runId)
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionKey: string, gatewayId: string): Promise<void> {
    const gateway = this.gateways.get(gatewayId)
    if (gateway?.status === 'connected') {
      await gateway.deleteSession(sessionKey)
    }
  }

  /**
   * Rename a session
   */
  async renameSession(sessionKey: string, name: string, gatewayId: string): Promise<void> {
    const gateway = this.gateways.get(gatewayId)
    if (gateway?.status === 'connected') {
      await gateway.renameSession(sessionKey, name)
    }
  }
}

// Singleton instance
let managerInstance: GatewayManager | null = null

export function getGatewayManager(): GatewayManager {
  if (!managerInstance) {
    managerInstance = new GatewayManager()
  }
  return managerInstance
}
