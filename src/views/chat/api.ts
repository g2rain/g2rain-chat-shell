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

interface AuthenticatedFetchInit extends RequestInit {
  body?: BodyInit | null
}

/**
 * Build fetch init with Bearer + DPoP (same contract as @g2rain/http business client).
 * `path` is the API segment after `/api`, e.g. `/v1/chat/completions`.
 */
async function buildAuthenticatedFetchInit(
  path: string,
  method: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<AuthenticatedFetchInit> {
  getHttpClient()
  const { sso } = await import('../../runtime/auth/sso')
  await sso.ensureAccessToken()

  const tokenStore = useAccessTokenStore()
  if (!tokenStore.isLogin || !tokenStore.tokenString) {
    throw new Error('NO_LOGIN')
  }

  const htu = apiPath(path)
  const client = tokenStore.client
  if (!client) {
    throw new Error('DPOP_CLIENT_REQUIRED')
  }

  const headers = new Headers(extraHeaders)
  headers.set('Authorization', `Bearer ${tokenStore.tokenString}`)
  const locale = useLocaleStore().locale
  if (locale && !headers.has('Accept-Language')) {
    headers.set('Accept-Language', locale)
  }

  let payload: BodyInit | undefined
  if (body !== undefined) {
    payload = JSON.stringify(body)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  }

  headers.set(
    'DPoP',
    await createDpopProof({
      url: htu,
      method: method.toUpperCase(),
      data: body,
      applicationCode: getApplicationCode(),
      client,
      jti: crypto.randomUUID(),
    }),
  )

  return {
    method: method.toUpperCase(),
    headers,
    body: payload,
  }
}

export class ChatApi {
  /** g2rain-agent-studio：启用中的数字员工 */
  static async listAgents(): Promise<AgentProfileItem[]> {
    const http = getHttpClient()
    const res = await http.client.get<AgentProfileItem[]>('/agent_profile/list', {
      status: 'ACTIVE',
    })
    return (res.data ?? []).filter((item) => item.id != null && item.agentName)
  }

  /** g2rain-model-nexus：启用中的模型服务配置（含 modelName） */
  static async listModels(): Promise<ModelProfileItem[]> {
    const http = getHttpClient()
    const res = await http.client.get<ModelProfileItem[]>('/model_service_profile/list', {
      status: 'ACTIVE',
    })
    return (res.data ?? []).filter((item) => item.id != null)
  }

  static async listConversations(): Promise<ChatConversation[]> {
    const http = getHttpClient()
    const res = await http.client.get<ChatConversation[]>('/chat_conversation/list')
    const rows = res.data ?? []
    return [...rows].sort((a, b) => {
      const ta = a.lastMessageTime ? Date.parse(a.lastMessageTime) : 0
      const tb = b.lastMessageTime ? Date.parse(b.lastMessageTime) : 0
      return tb - ta
    })
  }

  static async listMessages(conversationId: string): Promise<ChatMessageRecord[]> {
    const http = getHttpClient()
    const res = await http.client.get<ChatMessageRecord[]>('/chat_message/list', {
      conversationId,
    })
    return res.data ?? []
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    const http = getHttpClient()
    await http.client.post('/chat_conversation/delete', { conversationId })
  }

  static async sendTurn(
    req: TurnRequest,
    traceId: string,
    onProgress: (event: TurnEvent) => void,
    onResult: (event: TurnEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const init = await buildAuthenticatedFetchInit('/v1/chat/completions', 'POST', req, {
      Accept: 'text/event-stream',
      'X-TRACE-ID': traceId,
    })

    const resp = await fetch(apiUrl('/v1/chat/completions'), {
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
      buffer += value

      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)

        const data = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (!data) continue

        const event = JSON.parse(data) as TurnEvent
        if (event.type === 'PROGRESS') {
          onProgress(event)
        } else if (event.type === 'RESULT') {
          gotResult = true
          onResult(event)
        }
      }
    }

    if (!gotResult) {
      throw new Error('stream closed before RESULT')
    }
  }
}
