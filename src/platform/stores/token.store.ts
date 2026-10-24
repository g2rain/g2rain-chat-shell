import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { decodeJwt, jwtVerify } from 'jose'
import type { DpopClient } from '@g2rain/http'
import { getApplicationCode } from '../../shared/env'
import { publicKeyStringToJwk } from '../../shared/jwt'

export interface ApplicationScope {
  applicationCode: string
  scopes?: string[]
}

/** Non-sensitive JWT claims kept in memory for session decisions. */
export interface AccessTokenClaims {
  clientId: string
  clientPublicKey: string
  applicationScopes: ApplicationScope[]
  expireAt: number
  refreshExpireAt: number
  adminCompany: boolean
  organId?: number
  /** 当前用户 ID（员工会话）；切换身份时标记当前项 */
  userId?: string
  /** USER / PASSPORT / MEMBER / ANONYMOUS */
  sessionType?: string
  /** 展示用：姓名（访客为"访客"）、机构名称、是否机构管理员 */
  name?: string
  organName?: string
  adminUser?: boolean
}

export type TokenSessionStatus = 'NORMAL' | 'SSO' | 'LOGOUT'

/** 最近一次发起的授权模式：回调页据此区分员工登录与匿名访客 */
export type AuthMode = 'USER' | 'ANONYMOUS'

/** Legacy fixed key (pre-namespacing). Migrate once into the namespaced key when claims belong to this shell. */
const LEGACY_STORAGE_KEY = 'g2rain-shell-token'

/** Shell-owned persist key; namespace by applicationCode so multiple independent shells on the same origin do not share token state. */
function getTokenStorageKey(): string {
  return `${LEGACY_STORAGE_KEY}:${getApplicationCode()}`
}

interface PersistedTokenState {
  client: DpopClient | null
  token: AccessTokenClaims | null
  tokenString: string | null
  logged: boolean
  tokenExpired: boolean
  /** 匿名接入码：首次从 URL 或部署配置取得后持久化，退出登录也保留 */
  entryKey?: string | null
  authMode?: AuthMode | null
}

function parsePersisted(raw: string | null): PersistedTokenState | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedTokenState
  } catch {
    return null
  }
}

/** Migrate only when applicationScopes include this shell's code, so another shell's legacy session is not claimed. */
function belongsToCurrentShell(state: PersistedTokenState): boolean {
  const code = getApplicationCode()
  const scopes = state.token?.applicationScopes
  if (!scopes?.length) return false
  return scopes.some((scope) => scope.applicationCode === code)
}

/**
 * 旧版本持久化的 claims 没有展示字段（姓名、机构名称、用户 ID 等）：从当初已验签保存的 tokenString 补齐，
 * 只补展示与会话类型，不参与鉴权判断。
 */
function withDisplayClaims(state: PersistedTokenState | null): PersistedTokenState | null {
  const claims = state?.token
  const complete = claims?.sessionType && claims.organName !== undefined
    && (claims.userId !== undefined || claims.sessionType !== 'USER')
  if (!claims || !state.tokenString || complete) {
    return state
  }
  try {
    const payload = decodeJwt(state.tokenString)
    claims.sessionType ??= (payload.sessionType as string) || undefined
    claims.name ??= (payload.name as string) || undefined
    claims.organName ??= (payload.organName as string) || undefined
    claims.adminUser ??= payload.adminUser === true
    claims.userId ??= payload.userId != null && payload.userId !== '' ? String(payload.userId) : undefined
  } catch {
    /* 解析失败保持原样，下次换票或刷新时会写入完整 claims */
  }
  return state
}

function readPersisted(): PersistedTokenState | null {
  try {
    const storageKey = getTokenStorageKey()
    const current = parsePersisted(localStorage.getItem(storageKey))
    if (current) return current

    // One-time migrate from shared legacy key when it belongs to this shell.
    const legacy = parsePersisted(localStorage.getItem(LEGACY_STORAGE_KEY))
    if (!legacy || !belongsToCurrentShell(legacy)) return null
    localStorage.setItem(storageKey, JSON.stringify(legacy))
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return legacy
  } catch {
    return null
  }
}

/** @returns 是否写入成功；配额满或隐私模式下失败时访客身份无法跨页面保留 */
function writePersisted(state: PersistedTokenState): boolean {
  try {
    localStorage.setItem(getTokenStorageKey(), JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

function clearPersisted(): void {
  try {
    localStorage.removeItem(getTokenStorageKey())
  } catch {
    /* ignore */
  }
}

/**
 * Shell-owned Token Store. Satisfies @g2rain/http HttpAuthSession.
 * Persist key is g2rain-shell-token:${applicationCode} (same-origin multi-shell isolation).
 * Never put tokenString into public props, URL, Header UI, or durable logs.
 */
export const useAccessTokenStore = defineStore('shell-access-token', () => {
  const persisted = withDisplayClaims(readPersisted())

  const client = ref<DpopClient | null>(persisted?.client ?? null)
  const token = ref<AccessTokenClaims | null>(persisted?.token ?? null)
  const tokenString = ref<string | null>(persisted?.tokenString ?? null)
  const logged = ref(persisted?.logged ?? false)
  const status = ref<TokenSessionStatus>('NORMAL')
  const tokenExpired = ref(persisted?.tokenExpired ?? false)
  const entryKey = ref<string | null>(persisted?.entryKey ?? null)
  const authMode = ref<AuthMode | null>(persisted?.authMode ?? null)
  /** 本地存储是否可写；不可写时提示访客记录无法保存 */
  const persistable = ref(true)

  const isLogin = computed(() => {
    if (!client.value || !token.value) return false
    const refreshExpireAt = new Date(token.value.refreshExpireAt * 1000)
    return refreshExpireAt > new Date()
  })

  const isAccessTokenValid = computed(() => {
    if (!token.value?.expireAt) return false
    return new Date(token.value.expireAt * 1000) > new Date()
  })

  const organId = computed(() => token.value?.organId)

  /** 当前 token 是否为匿名访客会话 */
  const isAnonymous = computed(() => token.value?.sessionType === 'ANONYMOUS')

  function persistSnapshot(): void {
    persistable.value = writePersisted({
      client: client.value,
      token: token.value,
      tokenString: tokenString.value,
      logged: logged.value,
      tokenExpired: tokenExpired.value,
      entryKey: entryKey.value,
      authMode: authMode.value,
    })
  }

  function setTokenExpired(expired: boolean): void {
    tokenExpired.value = expired
    persistSnapshot()
  }

  function setStatus(next: TokenSessionStatus): void {
    status.value = next
  }

  async function setTokens(
    nextTokenString: string,
    tokenKid: string,
    iamKeyId: string,
    publicKey: string,
  ): Promise<void> {
    if (tokenKid !== iamKeyId) {
      throw new Error('TokenKid does not match IAM key id')
    }
    const publicKeyJwk = await publicKeyStringToJwk(publicKey)
    const { payload } = await jwtVerify(nextTokenString, publicKeyJwk)

    const rawOrganId = payload.organId
    const parsedOrganId =
      rawOrganId != null && rawOrganId !== '' ? Number(rawOrganId) : undefined

    tokenString.value = nextTokenString
    token.value = {
      clientId: (payload.clientId as string) || '',
      clientPublicKey: (payload.clientPublicKey as string) || '',
      applicationScopes: (payload.applicationScopes as ApplicationScope[]) || [],
      expireAt: (payload.expireAt as number) || 0,
      refreshExpireAt: (payload.refreshExpireAt as number) || 0,
      adminCompany: payload.adminCompany === true,
      organId:
        parsedOrganId != null && !Number.isNaN(parsedOrganId) ? parsedOrganId : undefined,
      userId: payload.userId != null && payload.userId !== '' ? String(payload.userId) : undefined,
      sessionType: (payload.sessionType as string) || undefined,
      name: (payload.name as string) || undefined,
      organName: (payload.organName as string) || undefined,
      adminUser: payload.adminUser === true,
    }
    logged.value = true
    status.value = 'NORMAL'
    tokenExpired.value = false
    if (client.value) {
      client.value = { ...client.value, isAuthenticated: true }
    }
    persistSnapshot()
  }

  /**
   * 退出登录：只清 token，保留 DPoP 密钥与接入码。
   * 访客身份由"机构 + 密钥指纹"决定，保留密钥才能在退出后回到原来的访客。
   */
  function logout(): void {
    token.value = null
    tokenString.value = null
    tokenExpired.value = false
    logged.value = false
    status.value = 'LOGOUT'
    if (client.value) {
      client.value = { ...client.value, isAuthenticated: false }
    }
    if (client.value || entryKey.value) {
      persistSnapshot()
    } else {
      clearPersisted()
    }
  }

  function setClient(next: DpopClient | null): void {
    client.value = next
    persistSnapshot()
  }

  /**
   * 采用其他标签页已持久化的密钥（生成密钥前在锁内调用，避免多标签页各生成一把）。
   *
   * @returns 是否已有可用密钥
   */
  function adoptPersistedClient(): boolean {
    if (client.value) return true
    const latest = readPersisted()
    if (!latest?.client) return false
    client.value = latest.client
    entryKey.value = entryKey.value ?? latest.entryKey ?? null
    return true
  }

  function setEntryKey(next: string | null): void {
    entryKey.value = next
    persistSnapshot()
  }

  function setAuthMode(next: AuthMode): void {
    authMode.value = next
    persistSnapshot()
  }

  return {
    client,
    token,
    tokenString,
    logged,
    status,
    tokenExpired,
    isLogin,
    isAccessTokenValid,
    organId,
    isAnonymous,
    entryKey,
    authMode,
    persistable,
    setTokenExpired,
    setStatus,
    setTokens,
    setClient,
    adoptPersistedClient,
    setEntryKey,
    setAuthMode,
    logout,
    persistSnapshot,
  }
})
