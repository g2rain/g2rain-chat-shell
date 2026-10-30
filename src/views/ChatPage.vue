<template>
  <div class="chat-page" :class="{ 'is-compact': compact }">
    <ConversationList
      :conversations="conversations"
      :active-conversation-id="activeConversationId"
      :active-nav-key="activeNavKey"
      :loading="loadingConversations"
      :streaming="streaming"
      :collapsed="!compact && sidebarCollapsed"
      :drawer="compact"
      :open="drawerOpen"
      :typing-id="typingId"
      @new-chat="startNewChat"
      @select="selectConversation"
      @delete="deleteConversation"
      @collapse="compact ? (drawerOpen = false) : (sidebarCollapsed = true)"
      @expand="sidebarCollapsed = false"
    />
    <Transition name="mask">
      <div v-if="compact && drawerOpen" class="drawer-mask" aria-hidden="true" @click="drawerOpen = false" />
    </Transition>
    <div class="chat-main">
      <!-- 紧凑布局（手机、平板竖屏）：侧栏收进抽屉，顶栏提供入口 -->
      <header v-if="compact" class="mobile-bar">
        <button
          type="button"
          class="bar-btn"
          :title="$t('CS_CHAT_OPEN_SIDEBAR', '打开侧栏')"
          :aria-label="$t('CS_CHAT_OPEN_SIDEBAR', '打开侧栏')"
          @click="drawerOpen = true"
        >
          <SidebarIcon />
        </button>
        <span class="bar-title">{{ activeTitle || baseTitle }}</span>
        <button
          type="button"
          class="bar-btn"
          :disabled="streaming"
          :title="$t('CS_CHAT_NEW', '新对话')"
          :aria-label="$t('CS_CHAT_NEW', '新对话')"
          @click="startNewChat"
        >
          <ComposeIcon />
        </button>
      </header>
      <ChatPanel
        :messages="messages"
        :loading-messages="loadingMessages"
        v-model:live-expanded="liveExpanded"
        :live-steps="liveSteps"
        :pending-actions="pendingActions"
        :streaming="streaming"
        :error-message="errorMessage"
        :can-retry="!!lastUserInput"
        :greeting-name="greetingName"
        :agents="agents"
        :models="models"
        v-model:agent-id="selectedAgentId"
        v-model:model="selectedModel"
        @send="sendUserInput"
        @action="sendAction"
        @retry="retryLast"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { t } from '../platform/i18n'
import { Generator } from '../shared/id'
import { useSessionStore } from '../platform/stores/session.store'
import { ChatApi } from './chat/api'
import { historyToChatItems, mergeStep } from './chat/messages'
import { baseTitle, useDocumentTitle } from './chat/document-title'
import { useCompact } from './chat/viewport'
import ComposeIcon from './chat/icons/ComposeIcon.vue'
import SidebarIcon from './chat/icons/SidebarIcon.vue'
import type {
  AgentProfileItem,
  ChatConversation,
  ChatMessageItem,
  ModelProfileItem,
  PendingTurnActions,
  ResumeAction,
  TurnEvent,
  TurnRequest,
  TurnStep,
} from './chat/type'
import ConversationList from './chat/ConversationList.vue'
import ChatPanel from './chat/ChatPanel.vue'

const sessionStore = useSessionStore()
const { user } = storeToRefs(sessionStore)
// 访客没有员工身份（user 为空），问候语不带名字
const greetingName = computed(() => user.value?.displayName ?? null)

const sidebarCollapsed = ref(false)
/** 紧凑布局下侧栏抽屉是否打开；转回宽屏时自动收起 */
const compact = useCompact()
const drawerOpen = ref(false)
watch(compact, () => (drawerOpen.value = false))
/** 上半区导航激活项；仅点击后设置，默认无底色 */
const activeNavKey = ref<string | null>(null)
const conversations = ref<ChatConversation[]>([])
const activeConversationId = ref<string | null>(null)
/** 刚由 TITLE 事件生成标题的会话：列表标题以打字机效果出现一次 */
const typingId = ref<string | null>(null)

/** 页面标题跟随当前会话；没有当前会话时还原页面原始标题 */
const activeTitle = computed(
  () => conversations.value.find((item) => item.conversationId === activeConversationId.value)?.title,
)
const documentTitle = useDocumentTitle(activeTitle)
const messages = ref<ChatMessageItem[]>([])
const loadingConversations = ref(false)
const loadingMessages = ref(false)
const streaming = ref(false)
/** 本轮执行中的步骤；不在执行时为 null */
const liveSteps = ref<TurnStep[] | null>(null)
/** 执行中的时间线是否展开；出结果后带到最终回复上，保持展开 */
const liveExpanded = ref(false)
const pendingActions = ref<PendingTurnActions | null>(null)
const lastUserInput = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
/** null = 默认路由 / 默认模型 */
const selectedAgentId = ref<number | null>(null)
const selectedModel = ref<string | null>(null)
const agents = ref<AgentProfileItem[]>([])
const models = ref<ModelProfileItem[]>([])

let abortController: AbortController | null = null

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function clearTurnUi(options?: { clearError?: boolean }): void {
  pendingActions.value = null
  liveSteps.value = null
  if (options?.clearError) {
    errorMessage.value = null
  }
}

function withComposerSelection(req: TurnRequest): TurnRequest {
  if (selectedAgentId.value != null) {
    req.agentId = selectedAgentId.value
  }
  if (selectedModel.value != null) {
    req.model = selectedModel.value
  }
  return req
}

async function loadConversations(): Promise<void> {
  loadingConversations.value = true
  errorMessage.value = null
  try {
    conversations.value = await ChatApi.listConversations()
  } catch (error) {
    errorMessage.value = toErrorMessage(error, t('CS_CHAT_ERR_LIST', '加载会话列表失败'))
  } finally {
    loadingConversations.value = false
  }
}

async function loadComposerOptions(): Promise<void> {
  const [agentResult, modelResult] = await Promise.allSettled([
    ChatApi.listAgents(),
    ChatApi.listModels(),
  ])
  agents.value = agentResult.status === 'fulfilled' ? agentResult.value : []
  models.value = modelResult.status === 'fulfilled' ? modelResult.value : []
}

async function selectConversation(conversationId: string): Promise<void> {
  if (streaming.value) return
  drawerOpen.value = false
  activeNavKey.value = null
  activeConversationId.value = conversationId
  clearTurnUi()
  await loadMessages(conversationId)
}

async function loadMessages(conversationId: string): Promise<void> {
  loadingMessages.value = true
  errorMessage.value = null
  try {
    const rows = await ChatApi.listMessages(conversationId)
    messages.value = historyToChatItems(rows)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, t('CS_CHAT_ERR_HISTORY', '加载历史消息失败'))
    messages.value = []
  } finally {
    loadingMessages.value = false
  }
}

function startNewChat(): void {
  if (streaming.value) return
  drawerOpen.value = false
  activeNavKey.value = 'new'
  activeConversationId.value = null
  messages.value = []
  clearTurnUi({ clearError: true })
}

async function deleteConversation(conversationId: string): Promise<void> {
  try {
    await ChatApi.deleteConversation(conversationId)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, t('CS_CHAT_ERR_DELETE', '删除会话失败'))
    return
  }
  conversations.value = conversations.value.filter((item) => item.conversationId !== conversationId)
  if (activeConversationId.value === conversationId) {
    startNewChat()
  }
}

/** 新会话生成标题：插到列表顶部并以打字机效果展示，页面标题同步；不再拉取会话列表 */
function applyTitle(event: TurnEvent): void {
  const conversationId = event.conversationId
  const title = event.text?.trim()
  if (!conversationId || !title) return
  // 先启动页面标题动画，随后的会话切换遇到同一标题不会打断它
  documentTitle.play(title)
  typingId.value = conversationId
  const existing = conversations.value.find((item) => item.conversationId === conversationId)
  if (existing) {
    existing.title = title
  } else {
    conversations.value = [{ conversationId, title }, ...conversations.value]
  }
  activeConversationId.value = conversationId
}

/** 本轮结束：当前会话移到列表顶部，代替重新拉取列表 */
function touchConversation(conversationId: string | null): void {
  if (!conversationId) return
  const index = conversations.value.findIndex((item) => item.conversationId === conversationId)
  if (index <= 0) return
  const next = conversations.value.slice()
  const [current] = next.splice(index, 1)
  conversations.value = [current, ...next]
}

function appendMessage(role: 'USER' | 'AGENT', content: string, extra?: Partial<ChatMessageItem>): void {
  messages.value.push({
    id: Generator.random(),
    role,
    content,
    ...extra,
    createdAtMs: extra?.createdAtMs ?? Date.now(),
  })
}

async function submitTurn(req: TurnRequest, optimisticUserText?: string): Promise<void> {
  if (streaming.value) return

  if (optimisticUserText) {
    lastUserInput.value = optimisticUserText
    appendMessage('USER', optimisticUserText)
  }

  streaming.value = true
  clearTurnUi({ clearError: true })
  liveSteps.value = []
  liveExpanded.value = false
  const startedAt = Date.now()

  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  const traceId = Generator.random()

  try {
    await ChatApi.sendTurn(
      req,
      traceId,
      (event) => {
        if (event.step) {
          liveSteps.value = mergeStep(liveSteps.value ?? [], event.step)
        }
        if (event.conversationId && !activeConversationId.value) {
          activeConversationId.value = event.conversationId
        }
      },
      applyTitle,
      (event) => {
        const steps = liveSteps.value ?? []
        liveSteps.value = null
        if (event.conversationId) {
          activeConversationId.value = event.conversationId
        }
        if (event.text) {
          // 优先服务端时间与耗时（与入库一致），缺失时用本地兜底；执行过程定格到这条回复上
          appendMessage('AGENT', event.text, {
            createdAtMs: event.createdAtMs,
            elapsedMs: event.elapsedMs ?? Date.now() - startedAt,
            progress: steps.length ? steps : undefined,
            traceId: event.traceId ?? traceId,
            failed: event.status === 'FAILED',
            progressExpanded: liveExpanded.value,
          })
        }
        pendingActions.value =
          event.status === 'WAITING' && event.actions?.length
            ? { actions: event.actions, suggestions: event.suggestions ?? [] }
            : null
      },
      controller.signal,
    )
    touchConversation(activeConversationId.value)
  } catch (error) {
    // 主动取消（切换会话、新一轮开始）不算失败
    if (controller.signal.aborted) {
      return
    }
    errorMessage.value = toErrorMessage(error, t('CS_CHAT_ERR_SEND', '发送失败'))
    if (activeConversationId.value) {
      void loadMessages(activeConversationId.value)
    }
  } finally {
    streaming.value = false
    liveSteps.value = null
    abortController = null
  }
}

async function sendUserInput(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const req = withComposerSelection({
    channel: 'web',
    userInput: trimmed,
    ...(activeConversationId.value ? { conversationId: activeConversationId.value } : {}),
    ...(pendingActions.value?.actions.includes('REPLY') ? { action: 'REPLY' as const } : {}),
  })
  await submitTurn(req, trimmed)
}

async function sendAction(action: ResumeAction, userInput?: string): Promise<void> {
  if (!activeConversationId.value) return

  const req = withComposerSelection({
    channel: 'web',
    conversationId: activeConversationId.value,
    action,
    ...(userInput ? { userInput } : {}),
  })
  await submitTurn(req, userInput)
}

async function retryLast(): Promise<void> {
  if (!lastUserInput.value) return
  await sendUserInput(lastUserInput.value)
}

onMounted(() => {
  void loadConversations()
  void loadComposerOptions()
})
</script>

<style scoped>
.chat-page {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--g2-bg-container, #fff);
}

.chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.chat-page.is-compact {
  position: relative;
}

.mobile-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: env(safe-area-inset-top) 6px 0;
  box-sizing: content-box;
  border-bottom: 1px solid var(--g2-border-color-light, #ececec);
  background: var(--g2-bg-container, #fff);
}

.bar-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--g2-text-primary);
  font-size: 15px;
  font-weight: 560;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--g2-text-primary);
  cursor: pointer;
}

.bar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 19;
  background: rgb(0 0 0 / 32%);
}

.mask-enter-active,
.mask-leave-active {
  transition: opacity 0.24s ease;
}

.mask-enter-from,
.mask-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .mask-enter-active,
  .mask-leave-active {
    transition: none;
  }
}
</style>
