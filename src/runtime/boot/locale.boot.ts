/**
 * 登录后加载可选语言列表并恢复用户选择（与 menu.boot 同模式）
 */

import { watch } from 'vue'
import { useAccessTokenStore } from '../../platform/stores/token.store'
import { useLocaleStore } from '../../platform/stores/locale.store'
import { resetI18nLoader } from '../../platform/i18n'

let watching = false

export async function initLocale(): Promise<void> {
  const tokenStore = useAccessTokenStore()
  const localeStore = useLocaleStore()

  if (!tokenStore.isLogin) {
    return
  }

  if (localeStore.initialized) {
    return
  }

  await localeStore.initialize()
}

export function startLocaleBoot(): void {
  if (watching) return
  watching = true

  const tokenStore = useAccessTokenStore()
  const localeStore = useLocaleStore()

  watch(
    () => tokenStore.isLogin,
    async (loggedIn) => {
      if (loggedIn) {
        try {
          await initLocale()
        } catch (error) {
          console.error('[locale.boot] 登录后加载语言列表失败:', error)
        }
        return
      }
      localeStore.reset()
      resetI18nLoader()
    },
    { immediate: true },
  )
}
