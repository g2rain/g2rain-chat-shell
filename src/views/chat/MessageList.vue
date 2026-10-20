<template>
  <div class="message-list">
    <div v-if="loading" class="message-status">加载历史消息…</div>

    <template v-else>
      <div
        v-for="message in messages"
        :key="message.id"
        class="message-row"
        :class="message.role === 'USER' ? 'is-user' : 'is-agent'"
      >
        <div class="message-row__inner">
          <div class="message-bubble">
            <div v-if="message.elapsedMs != null" class="message-elapsed">
              已执行 {{ formatDuration(message.elapsedMs) }}
            </div>
            <pre class="message-text">{{ message.content }}</pre>
            <div class="message-actions">
              <button
                type="button"
                class="copy-btn"
                :title="copiedId === message.id ? '已复制' : '复制'"
                :aria-label="copiedId === message.id ? '已复制' : '复制'"
                @click="copyMessage(message)"
              >
                <CheckIcon v-if="copiedId === message.id" />
                <CopyIcon v-else />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="progressText" class="message-row is-agent">
        <div class="message-row__inner">
          <div class="message-bubble progress">
            <span class="progress-text">{{ progressText }}</span>
            <span class="progress-elapsed">{{ elapsed }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ChatMessageItem } from './type'
import { formatDuration } from './messages'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'

const props = defineProps<{
  messages: ChatMessageItem[]
  loading: boolean
  progressText: string | null
}>()

/** 进度出现即开始计时，消失即停止 */
const now = ref(Date.now())
let startedAt = 0
let ticker: ReturnType<typeof setInterval> | null = null

function stopTicker(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
}

watch(
  () => props.progressText != null,
  (active) => {
    stopTicker()
    if (!active) return
    startedAt = Date.now()
    now.value = startedAt
    ticker = setInterval(() => (now.value = Date.now()), 1000)
  },
  { immediate: true },
)

onBeforeUnmount(stopTicker)

const elapsed = computed(() => formatDuration(now.value - startedAt))

const copiedId = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyMessage(message: ChatMessageItem): Promise<void> {
  const text = message.content?.trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    return
  }
  copiedId.value = message.id
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copiedId.value = null
    copiedTimer = null
  }, 1500)
}
</script>

<style scoped>
.message-list {
  width: 100%;
  padding: 24px 0 0;
}

.message-status {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--g2-text-secondary);
  font-size: 14px;
}

/* 整行占满右侧宽度，便于用户消息 hover 出复制 */
.message-row {
  width: 100%;
  box-sizing: border-box;
  padding: 0 16px;
  margin-bottom: 22px;
}

.message-row__inner {
  width: min(100%, 768px);
  margin: 0 auto;
  display: flex;
}

.message-row.is-user .message-row__inner {
  justify-content: flex-end;
}

.message-row.is-agent .message-row__inner {
  justify-content: flex-start;
}

.message-bubble {
  max-width: min(680px, 100%);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-row.is-user .message-bubble {
  align-items: flex-end;
}

.message-row.is-user .message-text {
  padding: 10px 16px;
  border-radius: 22px;
  background: #e8f0fe;
}

.message-row.is-agent .message-bubble {
  padding: 2px 0;
  background: transparent;
}

.message-bubble.progress {
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.message-elapsed {
  font-size: 13px;
  color: var(--g2-text-secondary);
}

.message-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.7;
  color: var(--g2-text-primary);
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  margin-top: 2px;
}

.message-row.is-user .message-actions {
  justify-content: flex-end;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--g2-text-secondary, #8e8e8e);
  cursor: pointer;
}

/* 用户消息：默认隐藏，滑过整行（含图标高度）才显示 */
.message-row.is-user .copy-btn {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.message-row.is-user:hover .copy-btn,
.message-row.is-user:focus-within .copy-btn {
  opacity: 1;
  pointer-events: auto;
}

.copy-btn:hover {
  background: var(--g2-bg-muted, #f5f5f5);
  color: var(--g2-text-primary);
}

/* 文字流光：渐变高光从左向右扫过 */
.progress-text {
  color: transparent;
  background: linear-gradient(
      90deg,
      var(--g2-text-secondary, #8e8e8e) 0%,
      var(--g2-text-secondary, #8e8e8e) 40%,
      var(--g2-text-primary, #1f1f1f) 50%,
      var(--g2-text-secondary, #8e8e8e) 60%,
      var(--g2-text-secondary, #8e8e8e) 100%
    )
    0 0 / 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: progress-shimmer 2s linear infinite;
}

.progress-elapsed {
  color: var(--g2-text-secondary);
  font-variant-numeric: tabular-nums;
}

@keyframes progress-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-text {
    animation: none;
    color: var(--g2-text-secondary);
  }
}
</style>
