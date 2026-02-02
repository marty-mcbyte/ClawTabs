export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Session {
  id: string
  name: string
  messages: Message[]
  isActive: boolean
  isTyping?: boolean
  createdAt: number
}
