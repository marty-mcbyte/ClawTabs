// IndexedDB layer for ClawTabs multi-gateway storage
import type { GatewayConfig, Agent, Channel, ChannelMessage } from '../types'

const DB_NAME = 'clawtabs'
const DB_VERSION = 1

// Store names
const STORES = {
  GATEWAYS: 'gateways',
  AGENTS: 'agents',
  CHANNELS: 'channels',
  MESSAGES: 'messages'
} as const

let dbInstance: IDBDatabase | null = null

/**
 * Open/initialize the IndexedDB database
 */
export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Gateways store
      if (!db.objectStoreNames.contains(STORES.GATEWAYS)) {
        const gatewayStore = db.createObjectStore(STORES.GATEWAYS, { keyPath: 'id' })
        gatewayStore.createIndex('url', 'url', { unique: false })
        gatewayStore.createIndex('addedAt', 'addedAt', { unique: false })
      }

      // Agents store
      if (!db.objectStoreNames.contains(STORES.AGENTS)) {
        const agentStore = db.createObjectStore(STORES.AGENTS, { keyPath: 'id' })
        agentStore.createIndex('gatewayId', 'gatewayId', { unique: false })
        agentStore.createIndex('status', 'status', { unique: false })
      }

      // Channels store
      if (!db.objectStoreNames.contains(STORES.CHANNELS)) {
        const channelStore = db.createObjectStore(STORES.CHANNELS, { keyPath: 'id' })
        channelStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Messages store
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
        const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' })
        messageStore.createIndex('channelId', 'channelId', { unique: false })
        messageStore.createIndex('agentId', 'agentId', { unique: false })
        messageStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

/**
 * Generic helper to get a store transaction
 */
async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await openDB()
  const tx = db.transaction(storeName, mode)
  return tx.objectStore(storeName)
}

/**
 * Generic put operation
 */
async function put<T>(storeName: string, item: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.put(item)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Generic get operation
 */
async function get<T>(storeName: string, id: string): Promise<T | undefined> {
  const store = await getStore(storeName, 'readonly')
  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Generic getAll operation
 */
async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName, 'readonly')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Generic delete operation
 */
async function del(storeName: string, id: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get items by index
 */
async function getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const store = await getStore(storeName, 'readonly')
  const index = store.index(indexName)
  return new Promise((resolve, reject) => {
    const request = index.getAll(value)
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============ Gateway CRUD ============

export async function getAllGateways(): Promise<GatewayConfig[]> {
  return getAll<GatewayConfig>(STORES.GATEWAYS)
}

export async function getGateway(id: string): Promise<GatewayConfig | undefined> {
  return get<GatewayConfig>(STORES.GATEWAYS, id)
}

export async function saveGateway(gateway: GatewayConfig): Promise<void> {
  return put(STORES.GATEWAYS, gateway)
}

export async function deleteGateway(id: string): Promise<void> {
  // Also delete associated agents
  const agents = await getAgentsByGateway(id)
  for (const agent of agents) {
    await deleteAgent(agent.id)
  }
  return del(STORES.GATEWAYS, id)
}

export async function updateGatewayStatus(id: string, status: GatewayConfig['status'], error?: string): Promise<void> {
  const gateway = await getGateway(id)
  if (gateway) {
    gateway.status = status
    gateway.error = error
    if (status === 'connected') {
      gateway.lastConnected = Date.now()
    }
    await saveGateway(gateway)
  }
}

// ============ Agent CRUD ============

export async function getAllAgents(): Promise<Agent[]> {
  return getAll<Agent>(STORES.AGENTS)
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  return get<Agent>(STORES.AGENTS, id)
}

export async function getAgentsByGateway(gatewayId: string): Promise<Agent[]> {
  return getByIndex<Agent>(STORES.AGENTS, 'gatewayId', gatewayId)
}

export async function saveAgent(agent: Agent): Promise<void> {
  return put(STORES.AGENTS, agent)
}

export async function deleteAgent(id: string): Promise<void> {
  return del(STORES.AGENTS, id)
}

// ============ Channel CRUD ============

export async function getAllChannels(): Promise<Channel[]> {
  return getAll<Channel>(STORES.CHANNELS)
}

export async function getChannel(id: string): Promise<Channel | undefined> {
  return get<Channel>(STORES.CHANNELS, id)
}

export async function saveChannel(channel: Channel): Promise<void> {
  return put(STORES.CHANNELS, channel)
}

export async function deleteChannel(id: string): Promise<void> {
  // Also delete channel messages
  const messages = await getMessagesByChannel(id)
  for (const msg of messages) {
    await deleteMessage(msg.id)
  }
  return del(STORES.CHANNELS, id)
}

// ============ Message CRUD ============

export async function getAllMessages(): Promise<ChannelMessage[]> {
  return getAll<ChannelMessage>(STORES.MESSAGES)
}

export async function getMessage(id: string): Promise<ChannelMessage | undefined> {
  return get<ChannelMessage>(STORES.MESSAGES, id)
}

export async function getMessagesByChannel(channelId: string): Promise<ChannelMessage[]> {
  return getByIndex<ChannelMessage>(STORES.MESSAGES, 'channelId', channelId)
}

export async function getMessagesByAgent(agentId: string): Promise<ChannelMessage[]> {
  return getByIndex<ChannelMessage>(STORES.MESSAGES, 'agentId', agentId)
}

export async function saveMessage(message: ChannelMessage): Promise<void> {
  return put(STORES.MESSAGES, message)
}

export async function deleteMessage(id: string): Promise<void> {
  return del(STORES.MESSAGES, id)
}

// ============ Utility ============

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAllData(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORES.GATEWAYS, STORES.AGENTS, STORES.CHANNELS, STORES.MESSAGES], 'readwrite')
  
  tx.objectStore(STORES.GATEWAYS).clear()
  tx.objectStore(STORES.AGENTS).clear()
  tx.objectStore(STORES.CHANNELS).clear()
  tx.objectStore(STORES.MESSAGES).clear()
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
