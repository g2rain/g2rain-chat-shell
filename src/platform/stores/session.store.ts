import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAccessTokenStore } from './token.store'
import {
  clearAuthorityUserCache,
  getAuthorityUser,
} from '../../runtime/api/authority-user'
import { openAuthBridge } from '../../components/micro-app'

/** Non-sensitive identity summary only. Never store Token / Secret here for display. */
export interface SessionUserSummary {
  displayName: string
  account: string
}

export interface SessionOrganSummary {
  name: string
  organCode: string
  /** Platform operator organ when true. */
  admin?: boolean
}

/**
 * Session / SSO state interface. Identity is filled after Token Store login
 * via /basis/authority/user.
 */
export const useSessionStore = defineStore('shell-session', () => {
  const user = ref<SessionUserSummary | null>(null)
  const organ = ref<SessionOrganSummary | null>(null)
  const availableOrgans = ref<SessionOrganSummary[]>([])

  const isLoggedIn = computed(() => user.value !== null)
  const hasOrgan = computed(() => organ.value !== null)

  function setUser(next: SessionUserSummary | null): void {
    user.value = next
  }

  function setOrgan(next: SessionOrganSummary | null): void {
    organ.value = next
  }

  function setAvailableOrgans(next: readonly SessionOrganSummary[]): void {
    availableOrgans.value = [...next]
  }

  function switchOrgan(organCode: string): void {
    const matched = availableOrgans.value.find((item) => item.organCode === organCode)
    if (!matched) {
      throw new Error(`Unknown organCode "${organCode}"`)
    }
    organ.value = matched
  }

  function clearSession(): void {
    user.value = null
    organ.value = null
    availableOrgans.value = []
    clearAuthorityUserCache()
  }

  /**
   * When Token Store reports login, load non-sensitive user/organ for Header.
   * Does not fabricate identity when not logged in.
   */
  /** 当前是匿名访客（有访客 token，但没有员工身份） */
  const isVisitor = computed(() => {
    const tokenStore = useAccessTokenStore()
    return tokenStore.isLogin && tokenStore.isAnonymous
  })

  /**
   * 用已验签的 token 填充身份与机构，不再阻塞请求 authority 用户信息。
   * 登录账号等 token 里没有的字段，在员工打开账号菜单时由 {@link loadAccount} 按需补齐。
   */
  async function bootstrapSession(): Promise<void> {
    const tokenStore = useAccessTokenStore()
    // 身份可能已变化（登录、退出、切换机构），丢弃上一身份的 authority 缓存
    clearAuthorityUserCache()
    const claims = tokenStore.token
    if (!tokenStore.isLogin || !claims) {
      clearSession()
      return
    }

    // 没有机构名称时不展示机构，避免出现"机构 2"这类内部 ID
    const summary: SessionOrganSummary | null = claims.organId != null
      ? {
          name: claims.organName ?? '',
          organCode: String(claims.organId),
          admin: claims.adminCompany,
        }
      : null
    setOrgan(summary)
    setAvailableOrgans(summary ? [summary] : [])

    if (tokenStore.isAnonymous) {
      setUser(null)
      return
    }

    openAuthBridge()
    setUser({ displayName: claims.name || '用户', account: '' })
  }

  /**
   * 补齐登录账号：员工首次打开账号菜单时查询一次，之后命中 authority 缓存；访客不查。
   */
  async function loadAccount(): Promise<void> {
    const current = user.value
    if (!current || current.account || isVisitor.value) return
    try {
      const authority = await getAuthorityUser()
      const account = authority.passport?.username || authority.email || String(authority.id)
      if (user.value === current) {
        setUser({ ...current, account })
      }
    } catch (error) {
      console.warn('[session] failed to load authority user:', error)
    }
  }

  return {
    user,
    organ,
    availableOrgans,
    isLoggedIn,
    isVisitor,
    hasOrgan,
    setUser,
    setOrgan,
    setAvailableOrgans,
    switchOrgan,
    clearSession,
    bootstrapSession,
    loadAccount,
  }
})
