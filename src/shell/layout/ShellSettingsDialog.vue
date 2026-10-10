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
      <div class="settings-content">
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
            :disabled="!localeInitialized || localeOptions.length === 0"
            :loading="!localeInitialized"
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
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Close, Moon, Sunny } from '@element-plus/icons-vue'
import type { G2rainTheme } from '@g2rain/platform/theme'
import { getMainPlatform } from '../../platform/main-platform'
import { getThemeController } from '../../platform/theme'
import { useLocaleStore } from '../../platform/stores/locale.store'
import { useRuntimeStore } from '../../platform/stores/runtime.store'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const localeStore = useLocaleStore()
const runtimeStore = useRuntimeStore()

const { locale, options: localeOptions, initialized: localeInitialized } = storeToRefs(localeStore)

const theme = ref<G2rainTheme>(getThemeController().getTheme())
const themeOptions: ReadonlyArray<{ value: G2rainTheme; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
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

async function onLocaleChange(next: string): Promise<void> {
  await localeStore.setLocale(next)
  const main = getMainPlatform()
  const instanceIds = [...runtimeStore.instances.keys()]
  await Promise.all(instanceIds.map((instanceId) => main.notifyLocale(instanceId, next)))
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
  min-height: 280px;
  margin: 0 -16px -12px;
  border-top: 1px solid var(--g2-border-color-light, #ececec);
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
