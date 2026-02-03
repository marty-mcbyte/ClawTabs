// OpenClaw Gateway WebSocket Client

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface PendingRequest {
  resolve: (payload: any) => void
  reject: (error: any) => void
}

export interface GatewayEventHandler {
  onConnectionChange?: (status: ConnectionStatus) => void
  onChatEvent?: (payload: any, eventType: string) => void
}

export class Gateway {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private reqId = 0
  private pending = new Map<string, PendingRequest>()
  private handlers: GatewayEventHandler = {}
  private _status: ConnectionStatus = 'disconnected'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
  }

  get status() { return this._status }

  setHandlers(h: GatewayEventHandler) {
    this.handlers = h
  }

  private setStatus(s: ConnectionStatus) {
    this._status = s
    this.handlers.onConnectionChange?.(s)
  }

  connect() {
    if (this.ws) return
    this.intentionalClose = false
    this.setStatus('connecting')
    
    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      console.log('[GW] WebSocket opened, waiting for challenge...')
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        console.log('[GW] Received:', msg.type, msg.event ?? msg.id ?? '', msg.ok ?? '')
        if (msg.type === 'res') {
          const p = this.pending.get(msg.id)
          if (p) {
            this.pending.delete(msg.id)
            if (msg.ok) p.resolve(msg.payload)
            else p.reject(msg.error)
          }
        } else if (msg.type === 'event') {
          if (msg.event === 'connect.challenge') {
            // Gateway sent challenge — now send our connect handshake
            this.handshake().then(() => {
              this.setStatus('connected')
            }).catch((err) => {
              console.error('Handshake failed:', err)
              ws.close()
            })
          } else if (msg.event === 'chat' || msg.event === 'agent') {
            this.handlers.onChatEvent?.(msg.payload, msg.event)
          }
        }
      } catch {}
    }

    ws.onclose = (ev) => {
      console.log('[GW] WebSocket closed:', ev.code, ev.reason)
      this.ws = null
      this.rejectAll('disconnected')
      this.setStatus('disconnected')
      if (!this.intentionalClose) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000)
      }
    }

    ws.onerror = (ev) => {
      console.error('[GW] WebSocket error:', ev)
    }
  }

  disconnect() {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.rejectAll('disconnected')
    this.setStatus('disconnected')
  }

  private rejectAll(reason: string) {
    for (const p of this.pending.values()) p.reject(reason)
    this.pending.clear()
  }

  private request(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject('not connected')
      }
      const id = String(++this.reqId)
      this.pending.set(id, { resolve, reject })
      const msg = { type: 'req', id, method, params }
      console.log('[GW] Sending:', method, params.attachments ? `(${params.attachments.length} attachments)` : '')
      this.ws.send(JSON.stringify(msg))
    })
  }

  private handshake(): Promise<any> {
    return this.request('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: { id: 'webchat', version: '0.2.0', platform: 'web', mode: 'webchat' },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      caps: [],
      commands: [],
      permissions: {},
      auth: { token: this.token },
      locale: 'en-US',
      userAgent: 'ClawTabs/0.2.0'
    })
  }

  private genIdempotencyKey(): string {
    return `ct-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  }

  async listSessions(): Promise<any[]> {
    const res = await this.request('sessions.list', {})
    return res?.sessions ?? res ?? []
  }

  async chatHistory(sessionKey: string): Promise<any[]> {
    const res = await this.request('chat.history', { sessionKey })
    return res?.messages ?? res ?? []
  }

  async chatSend(sessionKey: string, text: string, attachments?: any[]): Promise<any> {
    // Transform attachments to gateway format: { content: base64, mimeType }
    const gatewayAttachments = attachments?.map(att => {
      let content = att.dataUrl || att.content || ''
      // Strip data URL prefix if present
      const match = /^data:[^;]+;base64,(.*)$/.exec(content)
      if (match) {
        content = match[1]
      }
      return {
        content,
        mimeType: att.mimeType
      }
    })

    return this.request('chat.send', {
      sessionKey,
      message: text,
      idempotencyKey: this.genIdempotencyKey(),
      ...(gatewayAttachments?.length ? { attachments: gatewayAttachments } : {})
    })
  }

  async chatAbort(sessionKey: string, runId?: string): Promise<void> {
    await this.request('chat.abort', { sessionKey, ...(runId ? { runId } : {}) })
  }

  async deleteSession(sessionKey: string): Promise<void> {
    await this.request('sessions.delete', { sessionKey })
  }

  async renameSession(sessionKey: string, name: string): Promise<void> {
    await this.request('session.update', { sessionKey, displayName: name })
  }
}
