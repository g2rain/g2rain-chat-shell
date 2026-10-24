<template>
  <aside
    class="conversation-list"
    :class="{ collapsed, 'is-drawer': drawer, 'is-open': drawer && open }"
    :aria-hidden="drawer && !open"
  >
    <template v-if="collapsed">
      <div class="rail">
        <button
          type="button"
          class="icon-btn"
          title="打开侧栏"
          aria-label="打开侧栏"
          @click="emit('expand')"
        >
          <SidebarIcon />
        </button>
        <button
          type="button"
          class="icon-btn"
          :disabled="streaming"
          title="新对话"
          aria-label="新对话"
          @click="emit('newChat')"
        >
          <ComposeIcon />
        </button>
        <SidebarAccount collapsed />
      </div>
    </template>

    <template v-else>
      <div class="sidebar-header">
        <img :src="logoHeader" alt="谷雨开源SaaS平台" class="sidebar-logo" />
        <button
          type="button"
          class="icon-btn"
          title="关闭侧栏"
          aria-label="关闭侧栏"
          @click="emit('collapse')"
        >
          <SidebarIcon />
        </button>
      </div>

      <div class="sidebar-body">
        <div class="sidebar-nav">
          <button
            type="button"
            class="nav-item"
            :class="{ active: activeNavKey === 'new' }"
            :disabled="streaming"
            @click="emit('newChat')"
          >
            <ComposeIcon />
            <span>新对话</span>
          </button>
        </div>

        <div class="sidebar-recent">
          <div class="section-header">
            <button
              type="button"
              class="section-toggle"
              :aria-expanded="recentExpanded"
              @click="recentExpanded = !recentExpanded"
            >
              <span>最近</span>
              <ChevronIcon :expanded="recentExpanded" />
            </button>
          </div>

          <div v-show="recentExpanded" class="recent-body">
            <div v-if="loading" class="list-status">加载中…</div>
            <div v-else-if="conversations.length === 0" class="list-empty">
              <EmptyHistoryIcon />
              <span>暂无历史对话</span>
            </div>

            <nav v-else class="list-nav" @scroll="closeMenu">
              <div
                v-for="item in conversations"
                :key="item.conversationId"
                class="conversation-item"
                :class="{
                  active: item.conversationId === activeConversationId,
                  'menu-open': openMenuId === item.conversationId,
                }"
              >
                <button
                  type="button"
                  class="conversation-main"
                  :disabled="streaming"
                  @click="emit('select', item.conversationId)"
                >
                  <span class="conversation-title">
                    <TypewriterText v-if="item.conversationId === typingId && item.title" :text="item.title" />
                    <template v-else>{{ item.title || '新对话' }}</template>
                  </span>
                </button>
                <div class="more-wrap">
                  <button
                    type="button"
                    class="more-btn"
                    title="更多"
                    aria-label="更多"
                    :aria-expanded="openMenuId === item.conversationId"
                    @click.stop="toggleMenu(item.conversationId, $event)"
                  >
                    <MoreIcon />
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </div>

      <SidebarAccount />
    </template>

    <Teleport to="body">
      <div
        v-if="openMenuId && menuStyle"
        class="item-menu"
        :style="menuStyle"
        role="menu"
        @click.stop
      >
        <button
          type="button"
          class="item-menu__btn"
          role="menuitem"
          @click="onCopyId"
        >
          <CopyIcon />
          <span>复制会话 ID</span>
        </button>
        <button
          type="button"
          class="item-menu__btn danger"
          role="menuitem"
          @click="onDelete"
        >
          <TrashIcon />
          <span>删除</span>
        </button>
      </div>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import logoHeader from '@/assets/brand/logo-header.png'
import SidebarAccount from '../../shell/layout/SidebarAccount.vue'
import type { ChatConversation } from './type'
import ChevronIcon from './icons/ChevronIcon.vue'
import ComposeIcon from './icons/ComposeIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'
import EmptyHistoryIcon from './icons/EmptyHistoryIcon.vue'
import MoreIcon from './icons/MoreIcon.vue'
import SidebarIcon from './icons/SidebarIcon.vue'
import TrashIcon from './icons/TrashIcon.vue'
import TypewriterText from './TypewriterText.vue'

const props = defineProps<{
  conversations: ChatConversation[]
  activeConversationId: string | null
  activeNavKey: string | null
  loading: boolean
  streaming: boolean
  collapsed?: boolean
  /** 刚生成标题的会话：标题以打字机效果出现一次 */
  typingId?: string | null
  /** 紧凑布局：以抽屉形式从左侧滑出 */
  drawer?: boolean
  /** 抽屉是否打开；仅 drawer 时有效 */
  open?: boolean
}>()

const emit = defineEmits<{
  newChat: []
  select: [conversationId: string]
  delete: [conversationId: string]
  collapse: []
  expand: []
}>()

const recentExpanded = ref(true)
const openMenuId = ref<string | null>(null)
const menuStyle = ref<CSSProperties | null>(null)

function closeMenu(): void {
  openMenuId.value = null
  menuStyle.value = null
}

function toggleMenu(conversationId: string, event: MouseEvent): void {
  if (openMenuId.value === conversationId) {
    closeMenu()
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  openMenuId.value = conversationId
  // fixed + Teleport：不放开侧栏 overflow，避免列表透到左下角账号区
  menuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(8, rect.left - 8)}px`,
  }
}

/** 复制完整会话 ID，便于在会话观测中定位 */
async function onCopyId(): Promise<void> {
  const conversationId = openMenuId.value
  closeMenu()
  if (!conversationId) return
  try {
    await navigator.clipboard.writeText(conversationId)
    ElMessage.success('已复制会话 ID')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function onDelete(): Promise<void> {
  const conversationId = openMenuId.value
  const item = props.conversations.find((row) => row.conversationId === conversationId)
  closeMenu()
  if (!item) return

  const title = item.title?.trim() || '新对话'
  try {
    await ElMessageBox.confirm(`确定删除「${title}」吗？删除后不可恢复。`, '删除会话', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  emit('delete', item.conversationId)
}

function onDocumentClick(): void {
  closeMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('resize', closeMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('resize', closeMenu)
})
</script>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  width: 260px;
  min-width: 0;
  flex-shrink: 0;
  border-right: 1px solid var(--g2-border-color-light, #ececec);
  background: var(--g2-bg-container, #fff);
  overflow: hidden;
  transition: width 0.2s ease;
}

.conversation-list.collapsed {
  width: 52px;
  background: var(--g2-bg-container, #fff);
}

/* 抽屉：固定在左侧，只用 transform 做动画，不触发重排 */
.conversation-list.is-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  width: min(300px, 85vw);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  border-right: none;
  box-shadow: 0 0 24px rgb(0 0 0 / 12%);
  transform: translateX(-100%);
  visibility: hidden;
  transition:
    transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1),
    visibility 0s linear 0.26s;
  will-change: transform;
}

.conversation-list.is-drawer.is-open {
  transform: translateX(0);
  visibility: visible;
  transition:
    transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1),
    visibility 0s;
}

@media (prefers-reduced-motion: reduce) {
  .conversation-list.is-drawer,
  .conversation-list.is-drawer.is-open {
    transition: none;
  }
}

/* 触屏：没有悬停，更多按钮常显，点击区域加大 */
@media (hover: none) {
  .more-btn {
    width: 36px;
    height: 36px;
    opacity: 1;
  }

  .icon-btn {
    width: 40px;
    height: 40px;
  }

  .conversation-main {
    padding-top: 12px;
    padding-bottom: 12px;
  }
}

.rail {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 0;
  padding: 10px 0 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
  padding: 12px 10px 16px 14px;
}

.sidebar-logo {
  display: block;
  height: 28px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.sidebar-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.sidebar-nav {
  flex-shrink: 0;
  padding-bottom: 4px;
}

.sidebar-recent {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-top: 8px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--g2-text-primary);
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 16px);
  margin: 0 8px 2px;
  /* 左 3：对齐「最近」(8+6)；再扣掉 ComposeIcon viewBox 左侧空白 */
  padding: 10px 12px 10px 3px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--g2-text-primary);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}

.nav-item:hover:not(:disabled) {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.nav-item.active {
  background: color-mix(in srgb, var(--g2-text-primary) 8%, transparent);
}

.nav-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  width: calc(100% - 16px);
  margin: 0 8px;
  min-height: 32px;
  padding: 4px 0;
}

.section-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8f8f8f;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.section-toggle:hover,
.section-toggle:active,
.section-toggle:focus,
.section-toggle:focus-visible {
  background: transparent;
  color: #8f8f8f;
  outline: none;
}

.recent-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.list-status {
  padding: 8px 16px;
  color: var(--g2-text-secondary);
  font-size: 13px;
}

.list-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 0;
  padding: 16px;
  color: var(--g2-text-secondary, #8f8f8f);
  font-size: 13px;
}

.list-nav {
  flex: 1;
  overflow: auto;
  padding: 0 8px 12px;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 2px;
  border-radius: 10px;
}

.conversation-item:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.conversation-item.active {
  background: color-mix(in srgb, var(--g2-text-primary) 8%, transparent);
}

.conversation-main {
  flex: 1;
  min-width: 0;
  padding: 10px 4px 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
}

.conversation-main:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.conversation-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--g2-text-regular);
}

.conversation-item.active .conversation-title {
  color: var(--g2-text-primary);
}

.more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-right: 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--g2-text-secondary);
  cursor: pointer;
  opacity: 0;
}

.conversation-item:hover .more-btn,
.conversation-item.active .more-btn,
.conversation-item.menu-open .more-btn {
  opacity: 1;
}

.more-btn:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 8%, transparent);
  color: var(--g2-text-primary);
}

.more-wrap {
  position: relative;
  flex-shrink: 0;
}

.item-menu {
  position: fixed;
  z-index: 3000;
  min-width: 120px;
  width: max-content;
  padding: 4px;
  border: 1px solid var(--g2-border-color-light, #ececec);
  border-radius: 12px;
  background: var(--g2-bg-container, #fff);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--g2-text-primary) 12%, transparent);
}

.item-menu__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 28px 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--g2-text-primary);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  white-space: nowrap;
}

.item-menu__btn:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.item-menu__btn.danger {
  color: var(--g2-color-danger, #f56c6c);
}
</style>
