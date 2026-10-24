import { createDpopProof } from '@g2rain/http'
import { getApplicationCode, getContextPath } from '../../shared/env'
import { useAccessTokenStore } from '../../platform/stores/token.store'
import { useLocaleStore } from '../../platform/stores/locale.store'
import { getHttpClient } from '../../runtime/http'
import type {
  AgentProfileItem,
  ChatConversation,
  ChatMessageRecord,
  ModelProfileItem,
  TurnEvent,
  TurnRequest,
} from './type'

/** Business API path relative to `{contextPath}/api` (DPoP htu uses this segment only). */
function apiPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

/** Full browser URL for `{contextPath}/api/*`. */
function apiUrl(path: string): string {
  const segment = apiPath(path)
  const base = getContextPath()
  if (base === '/' || base === '') {
    return `/api${segment}`
  }
  return `${base}/api${segment}`
}

/**
 * SSE 走原生 fetch（@g2rain/http 无 stream）；鉴权与 business client 同契约（Bearer + DPoP）。
 * `path` 为 `/api` 后的业务段，同时作为 DPoP htu。
 */
async function buildAuthenticatedFetchInit(
  path: string,
  method: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<RequestInit> {
  const { sso } = await import('../../runtime/auth/sso')
  await sso.ensureAccessToken()

  const tokenStore = useAccessTokenStore()
  if (!tokenStore.isLogin || !tokenStore.tokenString) {
    throw new Error('NO_LOGIN')
  }
  const client = tokenStore.client
  if (!client) {
    throw new Error('DPOP_CLIENT_REQUIRED')
  }

  const headers = new Headers(extraHeaders)
  headers.set('Authorization', `Bearer ${tokenStore.tokenString}`)
  const locale = useLocaleStore().locale
  if (locale) {
    headers.set('Accept-Language', locale)
  }

  let payload: BodyInit | undefined
  if (body !== undefined) {
    payload = JSON.stringify(body)
    headers.set('Content-Type', 'application/json')
  }

  const upperMethod = method.toUpperCase()
  headers.set(
    'DPoP',
    await createDpopProof({
      url: apiPath(path),
      method: upperMethod,
      data: body,
      applicationCode: getApplicationCode(),
      client,
      jti: crypto.randomUUID(),
    }),
  )

  return { method: upperMethod, headers, body: payload }
}

function consumeSseBlocks(
  buffer: string,
  onEvent: (event: TurnEvent) => void,
): string {
  let rest = buffer
  let sep: number
  while ((sep = rest.indexOf('\n\n')) >= 0) {
    const block = rest.slice(0, sep)
    rest = rest.slice(sep + 2)
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data) continue
    onEvent(JSON.parse(data) as TurnEvent)
  }
  return rest
}

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

  static async sendTurn(
    req: TurnRequest,
    traceId: string,
    onProgress: (event: TurnEvent) => void,
    onTitle: (event: TurnEvent) => void,
    onResult: (event: TurnEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const init = await buildAuthenticatedFetchInit('/harness/v1/chat/completions', 'POST', req, {
      Accept: 'text/event-stream',
      'X-TRACE-ID': traceId,
    })

    const resp = await fetch(apiUrl('/harness/v1/chat/completions'), {
      ...init,
      signal,
    })

    if (!resp.ok || !resp.body) {
      throw new Error(`HTTP ${resp.status}`)
    }

    const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    let gotResult = false

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer = consumeSseBlocks(buffer + value, (event) => {
        if (event.type === 'PROGRESS') {
          onProgress(event)
        } else if (event.type === 'TITLE') {
          onTitle(event)
        } else if (event.type === 'RESULT') {
          gotResult = true
          onResult(event)
        }
      })
    }

    if (!gotResult) {
      throw new Error('stream closed before RESULT')
    }
  }
}
