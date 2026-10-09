export type TurnStatus = 'DONE' | 'WAITING' | 'FAILED' | 'CANCELLED'
export type ResumeAction = 'REPLY' | 'CONFIRM' | 'REJECT' | 'CANCEL'

export interface TurnEvent {
  type: 'PROGRESS' | 'RESULT'
  conversationId: string
  text?: string
  status?: TurnStatus
  actions?: ResumeAction[]
  suggestions?: string[]
}

export interface TurnRequest {
  channel: string
  conversationId?: string
  agentId?: number
  /** 模型服务配置 id；空则走平台默认模型（后端暂未消费时可忽略） */
  modelProfileId?: number
  userInput?: string
  action?: ResumeAction
}

export interface AgentProfileItem {
  id: number
  agentCode?: string
  agentName: string
  status?: string
}

export interface ModelProfileItem {
  id: number
  modelName?: string
  description?: string
  status?: string
}

export interface ChatConversation {
  id?: number
  conversationId: string
  title?: string
  lastMessageTime?: string
}

export interface ChatMessageRecord {
  id?: number
  messageId?: string
  conversationId?: string
  role?: string
  messageType?: string
  nodeId?: string
  content?: string
  createdAtMs?: number
}

export interface ChatMessageItem {
  id: string
  role: 'USER' | 'AGENT'
  content: string
  createdAtMs?: number
}

export interface PendingTurnActions {
  actions: ResumeAction[]
  suggestions: string[]
}
