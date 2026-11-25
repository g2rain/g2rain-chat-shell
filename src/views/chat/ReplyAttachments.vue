<template>
  <section v-if="reports.length" class="attachments">
    <article v-for="(attachment, index) in reports" :key="index" class="attachment">
      <header class="attachment__header">
        <strong>{{ attachment.title }}</strong>
        <button type="button" @click="toggle(index)">
          {{ expanded.has(index) ? $t('CS_CHAT_ATTACHMENT_COLLAPSE', '收起') : $t('CS_CHAT_ATTACHMENT_EXPAND', '展开') }}
        </button>
      </header>
      <div v-if="expanded.has(index)" class="attachment__body markdown">
        <template v-for="(block, blockIndex) in blocks(attachment.content)" :key="blockIndex">
          <div v-if="block.kind === 'markdown'" class="attachment__section" v-html="sanitizeHtml(block.html)" />
          <ReplyChart v-else :raw="block.raw" />
        </template>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type MarkdownIt from 'markdown-it'
import ReplyChart from './ReplyChart.vue'
import { createMarkdown, sanitizeHtml } from './markdown'
import type { ReplyAttachment } from './type'

const props = defineProps<{ attachments?: ReplyAttachment[] }>()
const reports = computed(() => props.attachments?.filter((item) => item.type === 'REPORT') ?? [])
const expanded = ref(new Set([0]))
const markdown: MarkdownIt = createMarkdown()

type ContentBlock = { kind: 'markdown'; html: string } | { kind: 'chart'; raw: string }

function blocks(content: string): ContentBlock[] {
  const tokens = markdown.parse(content, {})
  const result: ContentBlock[] = []
  let markdownTokens: typeof tokens = []

  const flushMarkdown = () => {
    if (!markdownTokens.length) return
    result.push({ kind: 'markdown', html: markdown.renderer.render(markdownTokens, markdown.options, {}) })
    markdownTokens = []
  }

  for (const token of tokens) {
    if (token.type === 'fence' && token.info.trim().split(/\s+/, 1)[0] === 'chart') {
      flushMarkdown()
      result.push({ kind: 'chart', raw: token.content })
    } else {
      markdownTokens.push(token)
    }
  }
  flushMarkdown()
  return result
}

function toggle(index: number): void {
  const next = new Set(expanded.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  expanded.value = next
}
</script>

<style scoped>
.attachments {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.attachment {
  overflow: hidden;
  border: 1px solid var(--g2-border-color);
  border-radius: 10px;
  color: var(--g2-text-primary);
  background: var(--g2-bg-container);
}

.attachment__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
}

.attachment__header button {
  border: 0;
  color: var(--g2-color-primary);
  background: transparent;
  cursor: pointer;
}

.attachment__body {
  overflow-x: auto;
  padding: 0 14px 14px;
}

.markdown :deep(p),
.markdown :deep(ul),
.markdown :deep(ol),
.markdown :deep(blockquote),
.markdown :deep(pre),
.markdown :deep(table) {
  margin: 0 0 12px;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4) {
  margin: 20px 0 8px;
}

.attachment__section:first-child > :deep(:first-child) {
  margin-top: 0;
}

.markdown :deep(.chart-frame) {
  margin: 0 0 16px;
}

.markdown > .chart-frame:last-child,
.attachment__section:last-child > :deep(:last-child) {
  margin-bottom: 0;
}

.markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.markdown :deep(th),
.markdown :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--g2-border-color);
}

.markdown :deep(th) {
  background: var(--g2-bg-muted);
  font-weight: 600;
}

.markdown :deep(pre) {
  white-space: pre-wrap;
}
</style>
