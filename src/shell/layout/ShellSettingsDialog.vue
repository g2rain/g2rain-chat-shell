<template>
  <el-dialog
    :model-value="modelValue"
    class="shell-settings-dialog"
    width="720px"
    align-center
    destroy-on-close
    :show-close="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="settings-header">
        <span class="settings-title">系统设置</span>
        <button type="button" class="close-btn" aria-label="关闭" @click="close">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="settings-body">
      <nav class="settings-nav" aria-label="设置分类">
        <button
          type="button"
          class="nav-item"
          :class="{ active: activeNav === 'general' }"
          @click="activeNav = 'general'"
        >
          <el-icon><Setting /></el-icon>
          <span>通用设置</span>
        </button>
        <button
          type="button"
          class="nav-item"
          :class="{ active: activeNav === 'account' }"
          @click="activeNav = 'account'"
        >
          <el-icon><User /></el-icon>
          <span>账号管理</span>
        </button>
      </nav>

      <div class="settings-content">
        <template v-if="activeNav === 'general'">
          <section class="setting-block">
            <h3 class="block-label">主题</h3>
            <div class="theme-cards">
              <button
                v-for="item in themeOptions"
                :key="item.value"
                type="button"
                class="theme-card"
                :class="{ active: theme === item.value }"
                @click="applyTheme(item.value)"
              >
                <el-icon class="theme-icon">
                  <Sunny v-if="item.value === 'light'" />
                  <Moon v-else />
                </el-icon>
                <span>{{ item.label }}</span>
              </button>
            </div>
          </section>

          <section class="setting-row">
            <span class="row-label">语言</span>
            <el-select
              :model-value="locale"
              class="locale-select"
              placement="bottom-end"
              @update:model-value="onLocaleChange"
            >
              <el-option
                v-for="item in localeOptions"
                :key="item.code"
                :label="item.label"
                :value="item.code"
              />
            </el-select>
          </section>
        </template>

        <template v-else>
          <section class="account-panel">
            <p class="account-line">{{ userDetail }}</p>
            <p class="account-line muted">当前机构：{{ organLabel }}</p>
            <button type="button" class="link-btn" @click="openPassport">
              打开账号管理
            </button>
          </section>
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Close, Moon, Setting, Sunny, User } from '@element-plus/icons-vue'
import type { G2rainTheme } from '@g2rain/platform/theme'
import { getMainPlatform } from '../../platform/main-platform'
import { getThemeController } from '../../platform/theme'
import { useLocaleStore, type ShellLocaleCode } from '../../platform/stores/locale.store'
import { useRuntimeStore } from '../../platform/stores/runtime.store'
import { useSessionStore } from '../../platform/stores/session.store'
import { useWorkspaceStore } from '../../platform/stores/workspace.store'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const session = useSessionStore()
const localeStore = useLocaleStore()
const runtimeStore = useRuntimeStore()
const workspace = useWorkspaceStore()

const { user, organ } = storeToRefs(session)
const { locale, options: localeOptions } = storeToRefs(localeStore)

const activeNav = ref<'general' | 'account'>('general')
const theme = ref<G2rainTheme>(getThemeController().getTheme())
const themeOptions: ReadonlyArray<{ value: G2rainTheme; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

const userDetail = computed(() => {
  if (!user.value) return '尚未登录'
  return `${user.value.displayName}（${user.value.account}）`
})

const organLabel = computed(() => organ.value?.name ?? '未选择机构')

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      activeNav.value = 'general'
      theme.value = getThemeController().getTheme()
    }
  },
)

function close(): void {
  emit('update:modelValue', false)
}

function applyTheme(next: G2rainTheme): void {
  getThemeController().setTheme(next)
  theme.value = next
}

async function onLocaleChange(next: ShellLocaleCode): Promise<void> {
  localeStore.setLocale(next)
  const main = getMainPlatform()
  const instanceIds = [...runtimeStore.instances.keys()]
  await Promise.all(instanceIds.map((instanceId) => main.notifyLocale(instanceId, next)))
}

function openPassport(): void {
  close()
  workspace.openShellView({
    viewId: 'shell.passport',
    title: '账号管理',
    kind: 'shell',
    closable: true,
    shellPage: 'passport',
  })
}
</script>

<style scoped>
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.settings-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--g2-text-primary);
}

.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--g2-text-secondary);
  cursor: pointer;
}

.close-btn:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
  color: var(--g2-text-primary);
}

.settings-body {
  display: flex;
  min-height: 320px;
  margin: 0 -16px -12px;
  border-top: 1px solid var(--g2-border-color-light, #ececec);
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 168px;
  flex-shrink: 0;
  padding: 12px 10px;
  border-right: 1px solid var(--g2-border-color-light, #ececec);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--g2-text-primary);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}

.nav-item:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.nav-item.active {
  background: color-mix(in srgb, var(--g2-text-primary) 8%, transparent);
  font-weight: 500;
}

.settings-content {
  flex: 1;
  min-width: 0;
  padding: 20px 24px 28px;
}

.setting-block {
  margin-bottom: 28px;
}

.block-label {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--g2-text-primary);
}

.theme-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 88px;
  padding: 16px 12px;
  border: 1px solid var(--g2-border-color-light, #ececec);
  border-radius: 12px;
  background: var(--g2-bg-container, #fff);
  color: var(--g2-text-primary);
  cursor: pointer;
  font-size: 13px;
}

.theme-card:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 4%, transparent);
}

.theme-card.active {
  border-color: transparent;
  background: color-mix(in srgb, var(--g2-text-primary) 8%, transparent);
}

.theme-icon {
  font-size: 22px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--g2-border-color-light, #ececec);
}

.row-label {
  font-size: 14px;
  color: var(--g2-text-primary);
}

.locale-select {
  width: 160px;
}

.account-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}

.account-line {
  margin: 0;
  font-size: 14px;
  color: var(--g2-text-primary);
}

.account-line.muted {
  color: var(--g2-text-secondary);
  font-size: 13px;
}

.link-btn {
  align-self: flex-start;
  margin-top: 8px;
  padding: 8px 14px;
  border: 1px solid var(--g2-border-color, #dcdfe6);
  border-radius: 8px;
  background: transparent;
  color: var(--g2-text-primary);
  cursor: pointer;
  font-size: 13px;
}

.link-btn:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}
</style>

<style>
.shell-settings-dialog.el-dialog {
  border-radius: 16px;
  overflow: hidden;
}

.shell-settings-dialog .el-dialog__header {
  margin: 0;
  padding: 16px 20px 12px;
}

.shell-settings-dialog .el-dialog__body {
  padding: 0 16px 12px;
}
</style>
