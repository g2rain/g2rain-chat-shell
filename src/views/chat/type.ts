export type TurnStatus = 'DONE' | 'WAITING' | 'FAILED' | 'CANCELLED'
export type ResumeAction = 'REPLY' | 'CONFIRM' | 'REJECT' | 'CANCEL'

export type StepStage = 'ROUTE' | 'PLAN' | 'NODE' | 'ROUND' | 'MODEL' | 'TOOL' | 'VERIFY'
export type StepStatus = 'RUNNING' | 'DONE' | 'FAILED'

/** 执行步骤；同一步骤的开始与结束共用 stepId，按 parentStepId 组成层级 */
export interface TurnStep {
  stepId: string
  parentStepId?: string
  stage: StepStage
  status: StepStatus
  title: string
  detail?: string
  nodeId?: string
  round?: number
  elapsedMs?: number
  errorCode?: string
}

export interface TurnEvent {
  type: 'PROGRESS' | 'TITLE' | 'RESULT'
  conversationId: string
  traceId?: string
  /** 执行步骤；仅 PROGRESS */
  step?: TurnStep
  text?: string
  status?: TurnStatus
  actions?: ResumeAction[]
  suggestions?: string[]
  /** 最终回复的发言时间 epoch ms，与入库一致；仅 RESULT */
  createdAtMs?: number
  /** 本轮耗时毫秒，与入库一致；仅 RESULT */
  elapsedMs?: number
  /** 失败时的业务错误码；仅 RESULT 且 FAILED */
  errorCode?: string
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

/** Chat 首页展示的租户问题模板。 */
export interface ChatPromptTemplate {
  id: number
  promptText: string
  sortOrder: number
  status: 'ACTIVE' | 'INACTIVE'
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
  traceId?: string
  /** 本轮执行步骤；仅最终回复 */
  progress?: TurnStep[]
}

export interface ChatMessageItem {
  id: string
  role: 'USER' | 'AGENT'
  content: string
  createdAtMs?: number
  /** 本轮执行耗时；仅 AGENT 最终回复，旧消息为空 */
  elapsedMs?: number
  /** 本轮执行步骤；仅 AGENT 最终回复 */
  progress?: TurnStep[]
  /** 本轮追踪号；失败时展示末 6 位 */
  traceId?: string
  /** 本轮是否失败 */
  failed?: boolean
  /** 执行过程是否展开；执行中展开过，出结果后保持展开 */
  progressExpanded?: boolean
}

export interface PendingTurnActions {
  actions: ResumeAction[]
  suggestions: string[]
}
