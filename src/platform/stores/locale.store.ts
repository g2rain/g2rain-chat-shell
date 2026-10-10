import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getLocaleCodeNameList, type LocaleCodeName } from '../../runtime/api/locale.api'
import { loadAndApplyI18nMessages } from '../i18n'

export interface ShellLocaleOption {
  code: string
  /** 展示名（来自后端 code_name_map.name） */
  label: string
}

const STORAGE_KEY = 'g2rain-shell-locale'

function loadSavedLocale(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value?.trim() || null
  } catch {
    return null
  }
}

function saveLocale(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* ignore quota / private mode */
  }
}

function toLocaleOption(item: LocaleCodeName): ShellLocaleOption {
  return {
    code: item.code,
    label: item.name,
  }
}

function resolveInitialLocale(options: ShellLocaleOption[], saved: string | null): string {
  if (saved && options.some((o) => o.code === saved)) {
    return saved
  }
  return options[0]?.code ?? ''
}

/**
 * Shell-owned locale：登录后拉 code_name_map，切换时拉 i18n 文案包，
 * 并驱动 G2rainUi locale / Main→Sub notifyLocale / Accept-Language。
 */
export const useLocaleStore = defineStore('shell-locale', () => {
  const options = ref<ShellLocaleOption[]>([])
  const locale = ref(loadSavedLocale() ?? '')
  const initialized = ref(false)
  let initializing: Promise<void> | null = null

  const label = computed(
    () => options.value.find((item) => item.code === locale.value)?.label ?? locale.value,
  )

  async function syncI18nMessages(force = false): Promise<void> {
    if (!locale.value) {
      return
    }
    await loadAndApplyI18nMessages(locale.value, force)
  }

  function applyLocale(code: string): void {
    if (!code || !options.value.some((o) => o.code === code)) {
      return
    }
    locale.value = code
    saveLocale(code)
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }
    if (initializing) {
      return initializing
    }

    initializing = (async () => {
      try {
        const list = await getLocaleCodeNameList()
        const mapped = list.map(toLocaleOption)
        options.value = mapped

        const saved = loadSavedLocale()
        const code = resolveInitialLocale(mapped, saved)
        if (code) {
          locale.value = code
          saveLocale(code)
        } else {
          locale.value = ''
        }

        initialized.value = true
        await syncI18nMessages(true)
      } catch (error) {
        console.error('[LocaleStore] 语言列表初始化失败:', error)
        throw error
      } finally {
        initializing = null
      }
    })()

    return initializing
  }

  async function setLocale(code: string): Promise<void> {
    if (!initialized.value) {
      console.warn('[LocaleStore] 尚未初始化，忽略切换:', code)
      return
    }
    if (locale.value === code) {
      return
    }
    applyLocale(code)
    await syncI18nMessages(true)
  }

  function reset(): void {
    options.value = []
    locale.value = loadSavedLocale() ?? ''
    initialized.value = false
    initializing = null
  }

  return {
    options,
    locale,
    label,
    initialized,
    initialize,
    setLocale,
    reset,
  }
})
