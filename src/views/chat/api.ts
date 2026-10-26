import { getHttpClient } from '../../runtime/http'
import type {
  AgentProfileItem,
  ChatConversation,
  ChatMessageRecord,
  ModelProfileItem,
  TurnEvent,
  TurnRequest,
} from './type'

export class ChatApi {
  /** g2rain-agent-studio：ACTIVE 数字员工下拉（id + agentName） */
  static async listAgents(): Promise<AgentProfileItem[]> {
    const http = getHttpClient()
    const res = await http.client.get<AgentProfileItem[]>('/studio/agent_profile/options')
    return (res.data ?? []).filter((item) => item.id != null && item.agentName)
  }

  /** g2rain-model-nexus：ACTIVE 模型下拉（value 用 modelName，展示用 displayName） */
  static async listModels(): Promise<ModelProfileItem[]> {
    const http = getHttpClient()
    const res = await http.client.get<ModelProfileItem[]>('/model/model_service_profile/options')
    return (res.data ?? []).filter((item) => item.modelName)
  }

  static async listConversations(): Promise<ChatConversation[]> {
    const http = getHttpClient()
    // 只返回当前员工或访客自己的会话，服务端已按最近消息时间倒序
    const res = await http.client.get<ChatConversation[]>('/harness/chat/conversation/list')
    return res.data ?? []
  }

  static async listMessages(conversationId: string): Promise<ChatMessageRecord[]> {
    const http = getHttpClient()
    const res = await http.client.get<ChatMessageRecord[]>('/harness/chat/message/list', {
      conversationId,
    })
    return res.data ?? []
  }

  /** DELETE /harness/chat/conversation/{id} — 主键 id，非 conversationId；只能删除自己的会话 */
  static async deleteConversation(conversationId: string): Promise<void> {
    const http = getHttpClient()
    await http.client.delete(`/harness/chat/conversation/${encodeURIComponent(conversationId)}`)
  }

  /** 发起一轮对话：SSE 与普通请求共用认证（Bearer、DPoP、401 刷新重放），按事件类型分发 */
  static async sendTurn(
    req: TurnRequest,
    traceId: string,
    onProgress: (event: TurnEvent) => void,
    onTitle: (event: TurnEvent) => void,
    onResult: (event: TurnEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const http = getHttpClient()
    let gotResult = false
    await http.client.sse<TurnEvent, TurnRequest>(
      '/harness/v1/chat/completions',
      req,
      (event) => {
        if (event.type === 'PROGRESS') {
          onProgress(event)
        } else if (event.type === 'TITLE') {
          onTitle(event)
        } else if (event.type === 'RESULT') {
          gotResult = true
          onResult(event)
        }
      },
      { headers: { 'X-TRACE-ID': traceId }, signal },
    )
    if (!gotResult) {
      throw new Error('stream closed before RESULT')
    }
  }
}
