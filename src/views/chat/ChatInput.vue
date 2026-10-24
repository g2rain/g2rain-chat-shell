<template>
  <div class="chat-input" :class="{ 'is-empty': emptyLayout }">
    <div class="chat-input__inner">
      <div v-if="pendingActions" class="action-bar">
        <div v-if="pendingActions.suggestions.length" class="suggestions">
          <button
            v-for="item in pendingActions.suggestions"
            :key="item"
            type="button"
            class="suggestion-btn"
            :disabled="disabled"
            @click="emit('action', 'REPLY', item)"
          >
            {{ item }}
          </button>
        </div>
        <div class="action-buttons">
          <button
            v-for="action in visibleActions"
            :key="action.value"
            type="button"
            class="action-btn"
            :class="{ primary: action.value === 'CONFIRM' }"
            :disabled="disabled"
            @click="emit('action', action.value)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>

      <div class="composer" :class="{ disabled }">
        <textarea
          ref="fieldRef"
          v-model="draft"
          class="composer__field"
          rows="1"
          placeholder="有问题，随便问"
          :disabled="disabled"
          @input="autoResize"
          @keydown.enter="onEnter"
          @compositionstart="composing = true"
          @compositionend="onCompositionEnd"
        />
        <div class="composer__footer">
          <div class="composer__tools">
            <label class="composer-select">
              <select
                class="composer-select__native"
                :value="agentId == null ? '' : String(agentId)"
                :disabled="disabled"
                aria-label="数字员工"
                @change="agentId = parseSelectId($event)"
              >
                <option value="">默认路由</option>
                <option
                  v-for="item in agents"
                  :key="item.id"
                  :value="String(item.id)"
                >
                  {{ item.agentName }}
                </option>
              </select>
            </label>
            <label class="composer-select">
              <select
                class="composer-select__native"
                :value="model ?? ''"
                :disabled="disabled"
                aria-label="模型"
                @change="model = parseSelectModel($event)"
              >
                <option value="">默认模型</option>
                <option
                  v-for="item in models"
                  :key="item.modelName"
                  :value="item.modelName"
                >
                  {{ item.displayName }}
                </option>
              </select>
            </label>
          </div>
          <button
            type="button"
            class="composer__send"
            :disabled="disabled || !draft.trim()"
            aria-label="发送"
            @click="submit"
          >
            <SendIcon />
          </button>
        </div>
      </div>
      <p class="disclaimer">G2rain Chat 由 AI 生成内容，可能不准确。重要信息请核实后再使用。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type {
  AgentProfileItem,
  ModelProfileItem,
  PendingTurnActions,
  ResumeAction,
} from './type'
import SendIcon from './icons/SendIcon.vue'

const props = defineProps<{
  disabled: boolean
  pendingActions: PendingTurnActions | null
  emptyLayout?: boolean
  agents: AgentProfileItem[]
  models: ModelProfileItem[]
}>()

const agentId = defineModel<number | null>('agentId', { required: true })
const model = defineModel<string | null>('model', { required: true })

const emit = defineEmits<{
  send: [text: string]
  action: [action: ResumeAction, userInput?: string]
}>()

const draft = ref('')
const fieldRef = ref<HTMLTextAreaElement | null>(null)

const actionLabels: Record<ResumeAction, string> = {
  CONFIRM: '确认',
  REJECT: '拒绝',
  CANCEL: '取消',
  REPLY: '回复',
}

const visibleActions = computed(() => {
  if (!props.pendingActions) return []
  return props.pendingActions.actions
    .filter((action) => action !== 'REPLY')
    .map((action) => ({
      value: action,
      label: actionLabels[action],
    }))
})

function parseSelectId(event: Event): number | null {
  const value = (event.target as HTMLSelectElement).value
  return value === '' ? null : Number(value)
}

function parseSelectModel(event: Event): string | null {
  const value = (event.target as HTMLSelectElement).value
  return value === '' ? null : value
}

function autoResize(): void {
  const el = fieldRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`
}

/** 输入法组合输入中（中文、日文等候选上屏前） */
const composing = ref(false)

/**
 * 组合结束后延到下一帧再清标记：部分浏览器先触发 compositionend、再触发确认上屏的那次 Enter。
 */
function onCompositionEnd(): void {
  requestAnimationFrame(() => {
    composing.value = false
  })
}

/** 触屏设备（手机、平板）：软键盘回车用于换行，靠发送按钮发送 */
function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

/**
 * 回车发送；以下情况保留默认行为（上屏或换行），不发送：
 * <ul>
 *   <li>输入法组合中：isComposing（Chrome / Firefox），key 为 Process，以及组合事件兜底（Safari 确认上屏时 isComposing 已为 false）</li>
 *   <li>带修饰键：Shift / Option(Alt) + Enter 换行，Ctrl / Cmd + Enter 不做处理</li>
 *   <li>触屏设备</li>
 * </ul>
 */
function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.key === 'Process' || composing.value) return
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
  if (isTouchDevice()) return
  event.preventDefault()
  submit()
}

function submit(): void {
  const text = draft.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  draft.value = ''
  void nextTick(autoResize)
}

watch(draft, () => {
  void nextTick(autoResize)
})
</script>

<style scoped>
.chat-input {
  position: relative;
  flex-shrink: 0;
  padding: 0 16px;
  background: transparent;
}

.chat-input.is-empty {
  width: 100%;
  padding: 0;
}

.chat-input__inner {
  width: min(100%, 768px);
  margin: 0 auto;
}

/* 输入框下方提示：上 8px、下 10px 留白，叠在半透明层之上 */
.disclaimer {
  position: relative;
  z-index: 2;
  margin: 0;
  padding: 8px 0 10px;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  color: var(--g2-text-secondary, #8e8e8e);
}

/* 输入框底 → 面板底：半透明层随提示高度伸缩（手机换行、安全区都能盖住） */
.chat-input:not(.is-empty) .disclaimer {
  background: color-mix(in srgb, var(--g2-bg-container, #fff) 55%, transparent);
}

.action-bar {
  margin-bottom: 10px;
}

.suggestions,
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.suggestions {
  margin-bottom: 8px;
}

.suggestion-btn,
.action-btn {
  border: 1px solid var(--g2-border-color);
  border-radius: 999px;
  background: var(--g2-bg-container);
  color: var(--g2-text-primary);
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.action-btn.primary {
  background: var(--g2-color-primary);
  border-color: var(--g2-color-primary);
  color: #fff;
}

.suggestion-btn:disabled,
.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.composer {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 10px 18px;
  border: 1px solid var(--g2-border-color, #e5e5e5);
  border-radius: 28px;
  background: var(--g2-bg-container, #fff);
  box-shadow: 0 2px 12px color-mix(in srgb, var(--g2-text-primary) 8%, transparent);
}

.composer.disabled {
  background: var(--g2-bg-muted, #f5f5f5);
  color: var(--g2-text-secondary, #8e8e8e);
}

.composer__field {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  max-height: 200px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--g2-text-primary);
  font-family: inherit;
  font-size: 16px;
  line-height: 22px;
  padding: 7px 0;
  overflow-y: auto;
}

.composer__field::placeholder {
  color: var(--g2-text-secondary);
}

.composer__field:disabled {
  cursor: not-allowed;
}

.composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.composer__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.composer-select {
  position: relative;
  flex-shrink: 0;
  min-width: 118px;
  max-width: 180px;
}

.composer-select__native {
  box-sizing: border-box;
  width: 100%;
  min-width: 118px;
  height: 28px;
  padding: 0 24px 0 12px;
  border: 1px solid var(--g2-border-color, #e5e5e5);
  border-radius: 999px;
  background: transparent;
  color: var(--g2-text-secondary, #8e8e8e);
  font-family: inherit;
  font-size: 12px;
  line-height: 26px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238f8f8f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.composer-select__native:hover:not(:disabled),
.composer-select__native:focus {
  border-color: color-mix(in srgb, var(--g2-text-primary) 28%, transparent);
  outline: none;
}

.composer-select__native:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.composer__send {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: #5b6cff;
  color: #fff;
  cursor: pointer;
}

.composer__send:disabled {
  background: #d8d8e0;
  color: #fff;
  cursor: not-allowed;
}

.composer__send:not(:disabled):hover {
  filter: brightness(1.05);
}

/* 底部手势条、Home 指示条让出安全区 */
.disclaimer {
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

/* 手机：边距收窄，两个下拉均分一行 */
@media (max-width: 767px) {
  .chat-input {
    padding: 0 12px;
  }

  /* 390 宽也能一行放下 */
  .disclaimer {
    font-size: 11px;
  }

  .composer__tools {
    flex: 1;
    flex-wrap: nowrap;
  }

  .composer-select {
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
  }

  .composer-select__native {
    min-width: 0;
  }
}

/* 触屏：发送按钮点击区域加大 */
@media (hover: none) {
  .composer__send {
    width: 40px;
    height: 40px;
  }
}
</style>
