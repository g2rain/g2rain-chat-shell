<template>
  <div class="chat-page">
    <ConversationList
      :conversations="conversations"
      :active-conversation-id="activeConversationId"
      :active-nav-key="activeNavKey"
      :loading="loadingConversations"
      :streaming="streaming"
      :collapsed="sidebarCollapsed"
      @new-chat="startNewChat"
      @select="selectConversation"
      @delete="deleteConversation"
      @collapse="sidebarCollapsed = true"
      @expand="sidebarCollapsed = false"
    />
    <div class="chat-main">
      <ChatPanel
        :messages="messages"
        :loading-messages="loadingMessages"
        :progress-text="progressText"
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
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Generator } from '../shared/id'
import { useSessionStore } from '../platform/stores/session.store'
import { ChatApi } from './chat/api'
import { historyToChatItems } from './chat/messages'
import type {
  AgentProfileItem,
  ChatConversation,
  ChatMessageItem,
  ModelProfileItem,
  PendingTurnActions,
  ResumeAction,
  TurnRequest,
} from './chat/type'
import ConversationList from './chat/ConversationList.vue'
import ChatPanel from './chat/ChatPanel.vue'

const sessionStore = useSessionStore()
const { user } = storeToRefs(sessionStore)
const greetingName = computed(() => user.value?.displayName ?? null)

const sidebarCollapsed = ref(false)
/** 上半区导航激活项；仅点击后设置，默认无底色 */
const activeNavKey = ref<string | null>(null)
const conversations = ref<ChatConversation[]>([])
const activeConversationId = ref<string | null>(null)
const messages = ref<ChatMessageItem[]>([])
const loadingConversations = ref(false)
const loadingMessages = ref(false)
const streaming = ref(false)
const progressText = ref<string | null>(null)
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
  progressText.value = null
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
    errorMessage.value = toErrorMessage(error, '加载会话列表失败')
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
    errorMessage.value = toErrorMessage(error, '加载历史消息失败')
    messages.value = []
  } finally {
    loadingMessages.value = false
  }
}

function startNewChat(): void {
  if (streaming.value) return
  activeNavKey.value = 'new'
  activeConversationId.value = null
  messages.value = []
  clearTurnUi({ clearError: true })
}

async function deleteConversation(id: number): Promise<void> {
  const target = conversations.value.find((item) => item.id === id)
  if (target?.id == null) {
    errorMessage.value = '会话缺少主键，无法删除'
    return
  }
  try {
    await ChatApi.deleteConversation(id)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '删除会话失败')
    return
  }
  conversations.value = conversations.value.filter((item) => item.id !== id)
  if (activeConversationId.value === target.conversationId) {
    startNewChat()
  }
}

function appendMessage(role: 'USER' | 'AGENT', content: string, elapsedMs?: number): void {
  messages.value.push({
    id: Generator.random(),
    role,
    content,
    createdAtMs: Date.now(),
    elapsedMs,
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
  progressText.value = '正在执行'
  const startedAt = Date.now()

  abortController?.abort()
  abortController = new AbortController()
  const traceId = Generator.random()

  try {
    await ChatApi.sendTurn(
      req,
      traceId,
      (event) => {
        if (event.text) {
          progressText.value = event.text
        }
        if (event.conversationId && !activeConversationId.value) {
          activeConversationId.value = event.conversationId
        }
      },
      (event) => {
        progressText.value = null
        if (event.conversationId) {
          activeConversationId.value = event.conversationId
        }
        if (event.text) {
          appendMessage('AGENT', event.text, Date.now() - startedAt)
        }
        pendingActions.value =
          event.status === 'WAITING' && event.actions?.length
            ? { actions: event.actions, suggestions: event.suggestions ?? [] }
            : null
      },
      abortController.signal,
    )
    void loadConversations()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return
    }
    errorMessage.value = toErrorMessage(error, '发送失败')
    if (activeConversationId.value) {
      void loadMessages(activeConversationId.value)
    }
  } finally {
    streaming.value = false
    progressText.value = null
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
</style>
