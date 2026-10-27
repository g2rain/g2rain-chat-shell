import { watch } from 'vue'
import {
  createDpopProof,
  type DpopClient,
  type EnsureAccessTokenOptions,
  type Result,
} from '@g2rain/http'
import {
  getAnonymousEntryKey,
  getApplicationCode,
  getAuthEndPoint,
  getPathWithContextPath,
  getRedirectUriPath,
  getSsoBaseUrl,
  getTokenEndPoint,
  isAuthPublicPath,
} from '../../shared/env'
import { Generator } from '../../shared/id'
import { generateClient } from '../../shared/jwt'
import { useAccessTokenStore, type AuthMode } from '../../platform/stores/token.store'
import {
  fetchIamKeyId,
  fetchIamPublicKey,
  getAuthHttpClient,
  getSignHttpClient,
  refreshBarrier,
} from '../http'
import { peekReturnUrl, saveReturnUrl } from '../navigation/sub-app-redirect'

export interface TokenRefreshResult {
  token: string
  tokenKid: string
  client?: DpopClient
}

/** 跨标签页共享的密钥生成锁名（按应用区分，与 token store 存储键一致） */
const CLIENT_LOCK = () => `g2rain-shell-client:${getApplicationCode()}`

/**
 * Shell-owned SSO orchestration. Uses @g2rain/http auth client for token exchange;
 * business client injects ensureAccessToken from this service.
 */
class SsoService {
  private isAuthenticationPending = false
  private isRefreshPending = false
  /** 等待同一次换票的调用方：成功时 resolve，失败时 reject，不会永远挂起 */
  private pendingSubscribers: Array<{ resolve: () => void; reject: (error: unknown) => void }> = []
  private refreshPromise: Promise<{ token: string; tokenKid: string }> | null = null
  private ensureAccessTokenPromise: Promise<void> | null = null
  private stopWatchTokenExpired: (() => void) | null = null
  private stopWatchLogged: (() => void) | null = null

  private getStore() {
    return useAccessTokenStore()
  }

  private createTokenProof(url: string, data: unknown, client: DpopClient | null, jti: string) {
    if (!client) throw new Error('DPoP client is required')
    return createDpopProof({
      url,
      method: 'post',
      params: '',
      data,
      applicationCode: getApplicationCode(),
      client,
      jti,
    })
  }

  private async callSignApi(
    data: unknown,
    headerDPoP: string,
    jti: string,
  ): Promise<string> {
    const http = getSignHttpClient()
    const response = await http.client.post<{ token: string }>(`/lua/sign_code?jti=${jti}`, data, {
      headers: {
        'Content-Type': 'application/json',
        DPoP: headerDPoP,
      },
    })
    const body = response as unknown as { token?: string }
    if (!body.token) {
      throw new Error('Failed to obtain Application-DPoP')
    }
    return body.token
  }

  /**
   * 员工登录：跳转 IAM 登录页（访客点"登录"也走这里，沿用同一把密钥）。
   */
  async redirectToSSO(): Promise<void> {
    if (!peekReturnUrl()) {
      saveReturnUrl()
    }
    await this.redirectToAuthorize('USER')
  }

  /**
   * 匿名访客授权：免登录直接发码，访客身份由 IAM 按密钥指纹推导。
   * 未配置接入码时回退为员工登录。
   */
  async authorizeAnonymous(): Promise<void> {
    const entryKey = this.resolveEntryKey()
    if (!entryKey) {
      await this.redirectToSSO()
      return
    }
    await this.redirectToAuthorize('ANONYMOUS', entryKey)
  }

  /**
   * 是否开放匿名访问：URL {@code ?entry=}、已保存的接入码或部署配置任一存在。
   */
  canAuthorizeAnonymous(): boolean {
    return Boolean(this.resolveEntryKey())
  }

  /**
   * 需要重新取得身份时的统一入口（未登录、刷新失败、退出登录）：
   * 开放匿名访问时回到访客身份，否则跳员工登录。
   */
  async reauthenticate(): Promise<void> {
    if (this.canAuthorizeAnonymous()) {
      await this.authorizeAnonymous()
      return
    }
    await this.redirectToSSO()
  }

  /**
   * 接入码优先级：URL {@code ?entry=} > 已保存 > 部署配置；URL 中的值会被保存，之后不再依赖 URL。
   */
  private resolveEntryKey(): string | null {
    const store = this.getStore()
    const fromUrl = new URLSearchParams(window.location.search).get('entry')?.trim()
    if (fromUrl && fromUrl !== store.entryKey) {
      store.setEntryKey(fromUrl)
    }
    return fromUrl || store.entryKey || getAnonymousEntryKey() || null
  }

  /**
   * 取得 DPoP 密钥；首次生成时加跨标签页锁，拿到锁后先采用其他标签页刚写入的密钥。
   */
  private async ensureClient(): Promise<DpopClient> {
    const store = this.getStore()
    if (store.client) return store.client

    const create = async (): Promise<void> => {
      if (store.adoptPersistedClient()) return
      store.setClient(await generateClient())
    }
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request(CLIENT_LOCK(), create)
    } else {
      await create()
    }

    if (!store.client) {
      throw new Error('Client not initialized')
    }
    return store.client
  }

  private async redirectToAuthorize(mode: AuthMode, entryKey?: string): Promise<void> {
    const client = await this.ensureClient()

    const ssoBaseUrl = getSsoBaseUrl()
    if (!ssoBaseUrl) {
      throw new Error('VITE_SSO_BASE_URL is not configured')
    }

    const redirectUri = window.location.origin + getPathWithContextPath(getRedirectUriPath())
    const ssoUrl = new URL(ssoBaseUrl + getAuthEndPoint())
    const params = new URLSearchParams({
      clientId: client.clientId,
      redirectUri,
      responseType: 'code',
      publicKey: JSON.stringify(client.publicKey),
    })
    if (mode === 'ANONYMOUS' && entryKey) {
      params.set('mode', 'ANONYMOUS')
      params.set('entryKey', entryKey)
    }
    ssoUrl.search = params.toString()

    const store = this.getStore()
    store.setAuthMode(mode)
    store.persistSnapshot()
    window.location.href = ssoUrl.toString()
  }

  async redirectToSSOIndex(): Promise<void> {
    const ssoBaseUrl = getSsoBaseUrl()
    if (!ssoBaseUrl) {
      throw new Error('VITE_SSO_BASE_URL is not configured')
    }
    window.location.href = new URL('/auth/index.html', ssoBaseUrl).toString()
  }

  async generateToken(code: string): Promise<void> {
    if (this.isAuthenticationPending) {
      return new Promise((resolve, reject) => {
        this.pendingSubscribers.push({ resolve, reject })
      })
    }

    this.isAuthenticationPending = true
    const store = this.getStore()
    const http = getAuthHttpClient()
    const data = { code, grantType: 'authorization_code' }
    const jti = Generator.random()
    // 签名等前置步骤也放进 try：失败时同样复位状态并通知等待者，重试不会挂起
    try {
      const dpop = await this.createTokenProof(getTokenEndPoint(), data, store.client, jti)
      const applicationDpop = await this.callSignApi(data, dpop, jti)
      const response = await http.client.post<{ token: string; keyId: string }>(
        getTokenEndPoint(),
        data,
        {
          headers: {
            DPoP: dpop,
            'Application-DPoP': applicationDpop,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )

      const result = response as unknown as Result<{ token: string; keyId: string }>
      if (result.status !== 200 && result.status !== 0) {
        throw new Error('GENERATE_TOKEN_FAILURE')
      }
      const { token, keyId } = result.data
      const signHttp = getSignHttpClient()
      const iamKeyId = await fetchIamKeyId(signHttp.client)
      const publicKey = await fetchIamPublicKey(signHttp.client)
      await store.setTokens(token, keyId, iamKeyId, publicKey)
      this.pendingSubscribers.splice(0).forEach(({ resolve }) => resolve())
    } catch (error) {
      this.pendingSubscribers.splice(0).forEach(({ reject }) => reject(error))
      throw error
    } finally {
      this.isAuthenticationPending = false
    }
  }

  async ensureAccessToken(opts?: EnsureAccessTokenOptions): Promise<void> {
    const store = this.getStore()
    if (!opts?.force && store.isAccessTokenValid) return
    if (!store.isLogin) throw new Error('NO_LOGIN')
    if (this.ensureAccessTokenPromise) return this.ensureAccessTokenPromise

    const run = (async () => {
      const barrier = refreshBarrier.waitForRefresh()
      // 真正错误由刷新调用本身抛出；这里只避免屏障无人 await 时的未处理 rejection
      void barrier.catch(() => undefined)
      await this.requestRefreshToken({ grantType: 'refresh_token' })
      await barrier
    })()

    this.ensureAccessTokenPromise = run.finally(() => {
      this.ensureAccessTokenPromise = null
    })
    return this.ensureAccessTokenPromise
  }

  async refreshToken(): Promise<TokenRefreshResult> {
    await this.ensureAccessToken({ force: true })
    const store = this.getStore()
    const iamKeyId = await fetchIamKeyId(getSignHttpClient().client)
    if (!store.tokenString) {
      throw new Error('TOKEN_REFRESH_FAILED')
    }
    return {
      token: store.tokenString,
      tokenKid: iamKeyId,
      client: store.client ?? undefined,
    }
  }

  async requestRefreshToken(requestData: {
    grantType: string
    userId?: string | number | null
  }): Promise<{ token: string; tokenKid: string }> {
    if (this.isRefreshPending && this.refreshPromise) {
      return this.refreshPromise
    }

    this.isRefreshPending = true
    const store = this.getStore()

    this.refreshPromise = (async () => {
      try {
        if (!store.isLogin || !store.tokenString) {
          throw new Error('NO_LOGIN')
        }

        const http = getAuthHttpClient()
        const jti = Generator.random()
        const dpop = await this.createTokenProof(
          getTokenEndPoint(),
          requestData,
          store.client,
          jti,
        )

        const response = await http.client.post<{ token: string; keyId: string }>(
          getTokenEndPoint(),
          requestData,
          {
            headers: {
              Authorization: `Bearer ${store.tokenString}`,
              DPoP: dpop,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        )

        const result = response as unknown as Result<{ token: string; keyId: string }>
        if (result.status !== 200 && result.status !== 0) {
          throw new Error('REFRESH_TOKEN_FAILURE')
        }

        const { token, keyId } = result.data
        const signHttp = getSignHttpClient()
        const iamKeyId = await fetchIamKeyId(signHttp.client)
        const publicKey = await fetchIamPublicKey(signHttp.client)
        await store.setTokens(token, keyId, iamKeyId, publicKey)
        refreshBarrier.resolveRefresh()
        return { token, tokenKid: keyId }
      } catch (error) {
        const refreshError = error instanceof Error ? error : new Error('TOKEN_REFRESH_FAILED')
        refreshBarrier.rejectRefresh(refreshError)
        throw refreshError
      } finally {
        this.isRefreshPending = false
        this.refreshPromise = null
        this.getStore().setTokenExpired(false)
      }
    })()

    return this.refreshPromise
  }

  /** Exchange token for another user context (tenant provision / organ switch). */
  async switchToken(userId: string | number): Promise<TokenRefreshResult> {
    // 等在途的普通刷新结束再换票：并入它的话 exchange_token 不会发出，身份不会切换
    while (this.refreshPromise) {
      await this.refreshPromise.catch(() => undefined)
    }
    const result = await this.requestRefreshToken({ grantType: 'exchange_token', userId })
    const store = this.getStore()
    return {
      token: result.token,
      tokenKid: result.tokenKid,
      client: store.client ?? undefined,
    }
  }

  start(): void {
    this.stop()
    const store = this.getStore()

    // 公开路径也挂 watch：登录态失效时需能跳转；仅跳过启动时立刻 redirect
    if (!isAuthPublicPath(window.location.pathname) && !store.isLogin && store.status === 'NORMAL') {
      void this.reauthenticate().catch((error) => {
        console.error('[SSO] redirect on start failed:', error)
      })
    }

    this.stopWatchTokenExpired = watch(
      () => store.tokenExpired,
      async (expired) => {
        if (!expired || !store.isLogin) return
        try {
          await this.ensureAccessToken()
        } catch (error) {
          console.error('[SSO] auto refresh failed:', error)
          if (store.status === 'NORMAL') {
            await this.reauthenticate()
          }
        }
      },
    )

    this.stopWatchLogged = watch(
      () => store.logged,
      async (logged) => {
        if (isAuthPublicPath(window.location.pathname)) return
        if (store.status === 'SSO' || store.status === 'LOGOUT') return
        if (!logged && store.status === 'NORMAL') {
          await this.reauthenticate()
        }
      },
      { immediate: true },
    )
  }

  stop(): void {
    this.stopWatchTokenExpired?.()
    this.stopWatchTokenExpired = null
    this.stopWatchLogged?.()
    this.stopWatchLogged = null
  }
}

export const sso = new SsoService()
