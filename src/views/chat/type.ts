export type TurnStatus = 'DONE' | 'WAITING' | 'FAILED' | 'CANCELLED'
export type ResumeAction = 'REPLY' | 'CONFIRM' | 'REJECT' | 'CANCEL'

export interface TurnEvent {
  type: 'PROGRESS' | 'RESULT'
  conversationId: string
  text?: string
  status?: TurnStatus
  actions?: ResumeAction[]
  suggestions?: string[]
  /** 最终回复的发言时间 epoch ms，与入库一致；仅 RESULT */
  createdAtMs?: number
  /** 本轮耗时毫秒，与入库一致；仅 RESULT */
  elapsedMs?: number
}

export interface TurnRequest {
  channel: string
  conversationId?: string
  agentId?: number
  /** 本轮选用的模型名；空则由模型服务按默认路由 */
  model?: string
  userInput?: string
  action?: ResumeAction
}

/** 对应 studio `/agent_profile/options`（仅 id + 名称） */
export interface AgentProfileItem {
  id: number
  agentName: string
}

/** 对应 model `/model_service_profile/options`；下拉 value 用 modelName，展示用 displayName */
export interface ModelProfileItem {
  id?: number
  modelName: string
  displayName: string
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
  /** 本轮耗时毫秒；仅最终回复 */
  elapsedMs?: number
}

export interface ChatMessageItem {
  id: string
  role: 'USER' | 'AGENT'
  content: string
  createdAtMs?: number
  /** 本轮执行耗时；仅 AGENT 最终回复，旧消息为空 */
  elapsedMs?: number
}

export interface PendingTurnActions {
  actions: ResumeAction[]
  suggestions: string[]
}
