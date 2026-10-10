<template>
  <section class="chat-panel" :class="{ 'is-empty': isEmpty }">
    <div v-if="errorMessage" class="chat-error">
      <span>{{ errorMessage }}</span>
      <button v-if="canRetry" type="button" class="retry-btn" @click="emit('retry')">
        重试
      </button>
    </div>

    <div v-if="isEmpty" class="empty-state">
      <h1 class="empty-greeting">我能帮你什么忙吗{{ greetingSuffix }}</h1>
      <ChatInput
        v-bind="composerBind"
        v-model:agent-id="agentId"
        v-model:model-profile-id="modelProfileId"
        empty-layout
        @send="emit('send', $event)"
        @action="onAction"
      />
    </div>

    <template v-else>
      <div ref="scrollRef" class="chat-scroll" @scroll="onScroll">
        <MessageList
          :messages="messages"
          :loading="loadingMessages"
          :progress-text="progressText"
        />
        <div class="scroll-spacer" aria-hidden="true" />
      </div>

      <div class="composer-dock">
        <button
          v-show="showJumpBottom"
          type="button"
          class="jump-bottom"
          title="回到底部"
          aria-label="回到底部"
          @click="scrollToBottom"
        >
          <ScrollDownIcon />
        </button>
        <ChatInput
          v-bind="composerBind"
          v-model:agent-id="agentId"
          v-model:model-profile-id="modelProfileId"
          @send="emit('send', $event)"
          @action="onAction"
        />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type {
  AgentProfileItem,
  ChatMessageItem,
  ModelProfileItem,
  PendingTurnActions,
  ResumeAction,
} from './type'
import ChatInput from './ChatInput.vue'
import MessageList from './MessageList.vue'
import ScrollDownIcon from './icons/ScrollDownIcon.vue'

const props = defineProps<{
  messages: ChatMessageItem[]
  loadingMessages: boolean
  progressText: string | null
  pendingActions: PendingTurnActions | null
  streaming: boolean
  errorMessage: string | null
  canRetry: boolean
  greetingName?: string | null
  agents: AgentProfileItem[]
  models: ModelProfileItem[]
}>()

const agentId = defineModel<number | null>('agentId', { required: true })
const modelProfileId = defineModel<number | null>('modelProfileId', { required: true })

const emit = defineEmits<{
  send: [text: string]
  action: [action: ResumeAction, userInput?: string]
  retry: []
}>()

const scrollRef = ref<HTMLElement | null>(null)
const showJumpBottom = ref(false)

const isEmpty = computed(
  () => !props.loadingMessages && props.messages.length === 0 && !props.progressText,
)

const greetingSuffix = computed(() => {
  const name = props.greetingName?.trim()
  return name ? `，${name}？` : '？'
})

const composerBind = computed(() => ({
  disabled: props.streaming,
  pendingActions: props.pendingActions,
  agents: props.agents,
  models: props.models,
}))

function onAction(action: ResumeAction, userInput?: string): void {
  emit('action', action, userInput)
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

function onScroll(): void {
  const el = scrollRef.value
  if (!el) return
  showJumpBottom.value = !isNearBottom(el)
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = scrollRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  showJumpBottom.value = false
}

watch(
  () => [props.messages.length, props.progressText, props.loadingMessages, isEmpty.value] as const,
  async () => {
    if (isEmpty.value) return
    const el = scrollRef.value
    if (!el || isNearBottom(el) || props.progressText) {
      await scrollToBottom()
    } else {
      onScroll()
    }
  },
)
</script>

<style scoped>
.chat-panel {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--g2-bg-container, #fff);
}

.chat-panel.is-empty {
  justify-content: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  width: min(100%, 768px);
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.empty-greeting {
  margin: 0;
  font-size: 28px;
  font-weight: 560;
  line-height: 1.35;
  color: var(--g2-text-primary);
  text-align: center;
}

.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.scroll-spacer {
  height: 160px;
}

.composer-dock {
  position: absolute;
  /* 右侧让出滚动条轨道，半透明底条不要盖上去 */
  right: 14px;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  background: transparent;
}

.composer-dock > * {
  pointer-events: auto;
}

.jump-bottom {
  position: relative;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-bottom: 10px;
  border: 1px solid var(--g2-border-color, #e5e5e5);
  border-radius: 50%;
  /* 略微透明，底下消息能透一点 */
  background: color-mix(in srgb, var(--g2-bg-container, #fff) 88%, transparent);
  color: var(--g2-text-primary);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--g2-text-primary) 10%, transparent);
  cursor: pointer;
}

.jump-bottom:hover {
  background: color-mix(in srgb, var(--g2-bg-muted, #f5f5f5) 92%, transparent);
}

.composer-dock :deep(.chat-input) {
  width: 100%;
}

.chat-error {
  position: absolute;
  top: 12px;
  right: 16px;
  left: 16px;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--g2-color-danger, #c45656) 10%, var(--g2-bg-container));
  color: var(--g2-color-danger, #c45656);
  font-size: 13px;
}

.retry-btn {
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
}
</style>
