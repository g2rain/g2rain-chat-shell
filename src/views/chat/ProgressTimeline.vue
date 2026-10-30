<template>
  <div class="timeline" :class="{ 'is-running': running, 'is-failed': failed }">
    <button
      type="button"
      class="timeline__header"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="timeline__arrow" :class="{ 'is-open': expanded }">▸</span>
      <span class="timeline__title" :class="{ shimmer: running }">{{ headline }}</span>
      <span v-if="durationText" class="timeline__duration">· {{ durationText }}</span>
    </button>

    <ul v-if="expanded" class="timeline__rows">
      <li
        v-for="row in rows"
        :key="row.step.stepId"
        class="timeline__row"
        :class="`is-${row.step.status.toLowerCase()}`"
        :style="{ '--depth': row.depth }"
      >
        <span class="timeline__icon" aria-hidden="true">{{ iconOf(row.step) }}</span>
        <span class="timeline__step">{{ row.step.title }}</span>
        <span v-if="row.step.detail" class="timeline__detail">{{ row.step.detail }}</span>
        <span v-if="row.step.elapsedMs != null" class="timeline__elapsed">
          {{ formatDuration(row.step.elapsedMs) }}
        </span>
      </li>
      <li v-if="traceId" class="timeline__trace">
        <button
          type="button"
          class="timeline__copy"
          :title="$t('CS_CHAT_COPY_TRACE', '复制完整追踪号')"
          @click="copyTrace"
        >
          {{ $t('CS_CHAT_TRACE', '追踪号') }} {{ traceId }}
          <CheckIcon v-if="copied" />
          <CopyIcon v-else />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '../../platform/i18n'
import type { TurnStep } from './type'
import { formatDuration, isFailed } from './messages'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'

const props = defineProps<{
  steps: TurnStep[]
  /** 本轮仍在执行：标题显示最新进行中的步骤并计时 */
  running?: boolean
  /** 本轮总耗时；结束后展示 */
  elapsedMs?: number
  /** 本轮追踪号；展开后底部展示，可复制完整值 */
  traceId?: string
  /** 初始是否展开 */
  defaultExpanded?: boolean
}>()

const emit = defineEmits<{ 'update:expanded': [expanded: boolean] }>()

const copied = ref(false)

async function copyTrace(): Promise<void> {
  if (!props.traceId) return
  try {
    await navigator.clipboard.writeText(props.traceId)
  } catch {
    return
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const expanded = ref(props.defaultExpanded ?? false)
watch(expanded, (value) => emit('update:expanded', value))
const failed = computed(() => isFailed(props.steps))

/** 按 parentStepId 深度优先展开为带缩进的行，保持开始顺序 */
const rows = computed(() => {
  const children = new Map<string | undefined, TurnStep[]>()
  for (const step of props.steps) {
    const key = props.steps.some((item) => item.stepId === step.parentStepId) ? step.parentStepId : undefined
    children.set(key, [...(children.get(key) ?? []), step])
  }
  const result: { step: TurnStep; depth: number }[] = []
  const walk = (parent: string | undefined, depth: number): void => {
    for (const step of children.get(parent) ?? []) {
      result.push({ step, depth })
      walk(step.stepId, depth + 1)
    }
  }
  walk(undefined, 0)
  return result
})

const current = computed(() => [...props.steps].reverse().find((step) => step.status === 'RUNNING'))

const headline = computed(() =>
  props.running
    ? (current.value?.title ?? t('CS_CHAT_PROCESSING', '正在处理'))
    : t('CS_CHAT_PROGRESS', '执行过程'),
)

/** 执行中本地计时，结束后用本轮耗时 */
const now = ref(Date.now())
let startedAt = Date.now()
let ticker: ReturnType<typeof setInterval> | null = null

function stopTicker(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
}

watch(
  () => props.running,
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

const durationText = computed(() => {
  if (props.running) return formatDuration(now.value - startedAt)
  return props.elapsedMs != null ? formatDuration(props.elapsedMs) : ''
})

function iconOf(step: TurnStep): string {
  if (step.status === 'FAILED') return '✗'
  if (step.status === 'DONE') return '✓'
  return '•'
}
</script>

<style scoped>
.timeline {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--g2-text-secondary, #8e8e8e);
}

.timeline__header {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.timeline__header:hover .timeline__title {
  color: var(--g2-text-primary, #1f1f1f);
}

.timeline.is-failed .timeline__header {
  color: var(--g2-color-danger, #d93025);
}

.timeline__arrow {
  display: inline-block;
  transition: transform 0.15s ease;
}

.timeline__arrow.is-open {
  transform: rotate(90deg);
}

.timeline__duration,
.timeline__elapsed {
  font-variant-numeric: tabular-nums;
}

.timeline__rows {
  margin: 4px 0 0;
  padding: 0 0 0 14px;
  list-style: none;
  border-left: 1px solid var(--g2-border-color, #e5e5e5);
}

.timeline__row {
  --indent: 16px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-left: calc(var(--depth, 0) * var(--indent));
  line-height: 1.8;
}

.timeline__icon {
  width: 12px;
  flex-shrink: 0;
  text-align: center;
}

.timeline__row.is-done .timeline__icon {
  color: var(--g2-color-success, #1e8e3e);
}

.timeline__row.is-failed {
  color: var(--g2-color-danger, #d93025);
}

.timeline__step {
  color: var(--g2-text-primary, #1f1f1f);
}

.timeline__row.is-failed .timeline__step {
  color: inherit;
}

.timeline__detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline__trace {
  margin-top: 6px;
}

.timeline__copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--g2-text-secondary, #8e8e8e);
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.timeline__copy:hover {
  color: var(--g2-text-primary, #1f1f1f);
}

.timeline__copy :deep(svg) {
  width: 14px;
  height: 14px;
}

/* 执行中标题流光：渐变高光从左向右扫过 */
.shimmer {
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
  animation: timeline-shimmer 2s linear infinite;
}

@keyframes timeline-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shimmer {
    animation: none;
    color: var(--g2-text-secondary, #8e8e8e);
  }
}

/* 手机：缩进收窄，说明换行展示不截断 */
@media (max-width: 767px) {
  .timeline__row {
    --indent: 12px;
    flex-wrap: wrap;
    row-gap: 0;
  }

  /* 说明排到耗时之后，耗时留在标题行 */
  .timeline__detail {
    order: 1;
    flex-basis: 100%;
    padding-left: 20px;
    white-space: normal;
  }
}
</style>
