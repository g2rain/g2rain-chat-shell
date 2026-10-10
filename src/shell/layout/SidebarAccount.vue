<template>
  <div class="sidebar-account" :class="{ collapsed }">
    <el-popover
      v-model:visible="menuOpen"
      :placement="collapsed ? 'right-end' : 'top-start'"
      :width="280"
      trigger="click"
      :hide-after="0"
      popper-class="sidebar-account-popper"
      @after-leave="userFlyoutOpen = false"
    >
      <template #reference>
        <button
          type="button"
          class="profile-trigger"
          :class="{ collapsed }"
          :title="displayName"
          aria-label="账号菜单"
        >
          <span class="avatar">{{ userInitial }}</span>
          <span v-if="!collapsed" class="profile-name">{{ displayName }}</span>
        </button>
      </template>

      <div class="account-menu">
        <!-- 一级：机构卡，右侧 >；hover 出二级用户列表 -->
        <div
          class="organ-card"
          @mouseenter="openUserFlyout"
          @mouseleave="scheduleCloseUserFlyout"
        >
          <span class="avatar sm">{{ organInitial }}</span>
          <span class="organ-text">
            <span class="organ-name">{{ organName }}</span>
            <span class="organ-sub">{{ displayName }}</span>
          </span>
          <el-icon class="row-chevron"><ArrowRight /></el-icon>

          <div
            v-show="userFlyoutOpen"
            class="user-flyout"
            @mouseenter="openUserFlyout"
            @click.stop
          >
            <div class="flyout-identity">
              <el-icon class="identity-icon"><User /></el-icon>
              <span class="identity-text">{{ accountLabel }}</span>
            </div>
            <button
              v-for="item in userChoices"
              :key="item.key"
              type="button"
              class="flyout-user"
              :class="{ active: item.key === selectedUserKey }"
              @click="selectUser(item.key)"
            >
              <span class="avatar sm">{{ item.initial }}</span>
              <span class="flyout-user-name">{{ item.label }}</span>
              <span v-if="item.key === selectedUserKey" class="flyout-check">✓</span>
            </button>
          </div>
        </div>

        <button type="button" class="menu-item menu-item--settings" @click="openSettings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </button>
        <button
          v-if="isLoggedIn"
          type="button"
          class="menu-item"
          @click="logout"
        >
          <el-icon><SwitchButton /></el-icon>
          <span>退出登录</span>
        </button>
      </div>
    </el-popover>

    <ShellSettingsDialog v-model="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowRight, Setting, SwitchButton, User } from '@element-plus/icons-vue'
import { useSessionStore } from '../../platform/stores/session.store'
import { useAccessTokenStore } from '../../platform/stores/token.store'
import { useMenuStore } from '../../platform/stores/menu.store'
import { useRuntimeStore } from '../../platform/stores/runtime.store'
import {
  clearReturnUrl,
  resetNavigationRestoreState,
} from '../../runtime/navigation/sub-app-redirect'
import ShellSettingsDialog from './ShellSettingsDialog.vue'

defineProps<{
  collapsed?: boolean
}>()

const router = useRouter()
const session = useSessionStore()
const runtimeStore = useRuntimeStore()
const tokenStore = useAccessTokenStore()
const menuStore = useMenuStore()

const { user, organ, isLoggedIn } = storeToRefs(session)
const settingsOpen = ref(false)
const menuOpen = ref(false)
const userFlyoutOpen = ref(false)
const selectedUserKey = ref('current')
let closeFlyoutTimer: ReturnType<typeof setTimeout> | null = null

const displayName = computed(() => {
  if (!isLoggedIn.value || !user.value) return '游客'
  return user.value.displayName || user.value.account || '用户'
})

const accountLabel = computed(() => {
  if (!isLoggedIn.value || !user.value) return '未登录'
  return user.value.account || user.value.displayName
})

const organName = computed(() => organ.value?.name || '未选择机构')
const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())
const organInitial = computed(() => organName.value.slice(0, 1).toUpperCase())

const userChoices = computed(() => {
  const currentLabel = displayName.value
  return [
    {
      key: 'current',
      label: currentLabel,
      initial: currentLabel.slice(0, 1).toUpperCase(),
    },
    { key: 'demo-1', label: 'demo.user', initial: 'D' },
    { key: 'demo-2', label: 'guest.user', initial: 'G' },
  ]
})

watch(
  () => user.value?.account,
  () => {
    selectedUserKey.value = 'current'
  },
)

function openUserFlyout(): void {
  if (closeFlyoutTimer) {
    clearTimeout(closeFlyoutTimer)
    closeFlyoutTimer = null
  }
  userFlyoutOpen.value = true
}

function scheduleCloseUserFlyout(): void {
  if (closeFlyoutTimer) clearTimeout(closeFlyoutTimer)
  // 留给鼠标穿过一级/二级间隙的时间；进入二级会 cancel
  closeFlyoutTimer = setTimeout(() => {
    userFlyoutOpen.value = false
    closeFlyoutTimer = null
  }, 200)
}

function selectUser(key: string): void {
  selectedUserKey.value = key
}

function openSettings(): void {
  menuOpen.value = false
  settingsOpen.value = true
}

async function logout(): Promise<void> {
  menuOpen.value = false
  await runtimeStore.releaseAllOnLogout()
  menuStore.reset()
  clearReturnUrl()
  resetNavigationRestoreState()
  tokenStore.logout()
  session.clearSession()
  await router.push('/logout')
}
</script>

<style scoped>
.sidebar-account {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  margin-top: auto;
  padding: 8px 8px 12px;
  background: var(--g2-bg-container, #fff);
}

.sidebar-account.collapsed {
  align-items: center;
  padding: 8px 0 12px;
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--g2-text-primary);
  cursor: pointer;
  text-align: left;
}

.profile-trigger.collapsed {
  width: 36px;
  height: 36px;
  justify-content: center;
  padding: 0;
  border-radius: 8px;
}

.profile-trigger:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--g2-color-primary) 18%, transparent);
  color: var(--g2-color-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.profile-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--g2-text-primary);
}

.account-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.organ-card {
  position: relative;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  box-sizing: border-box;
  cursor: pointer;
}

.organ-card:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.avatar.sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--g2-color-primary) 18%, transparent);
  color: var(--g2-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.organ-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  gap: 2px;
}

.organ-name,
.organ-sub {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.organ-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--g2-text-primary);
  line-height: 1.3;
}

.organ-sub {
  font-size: 12px;
  color: var(--g2-text-secondary);
  line-height: 1.3;
}

.row-chevron {
  flex: 0 0 auto;
  font-size: 14px;
  color: var(--g2-text-secondary);
}

.user-flyout {
  position: absolute;
  top: 0;
  /* 与一级保持可见间隙（对齐 ChatGPT），不叠在一起 */
  left: calc(100% + 8px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 240px;
  padding: 6px;
  border: 1px solid var(--g2-border-color-light, #ececec);
  border-radius: 14px;
  background: var(--g2-bg-container, #fff);
  box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  box-sizing: border-box;
}

/* 透明桥：盖住 8px 间隙，鼠标从机构行移到二级时不会掉出 hover 区域 */
.user-flyout::before {
  content: '';
  position: absolute;
  top: 0;
  right: 100%;
  width: 10px;
  height: 100%;
}

.flyout-identity,
.flyout-user,
.menu-item {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--g2-text-primary);
  box-sizing: border-box;
  text-align: left;
}

.flyout-identity {
  cursor: default;
  color: var(--g2-text-secondary);
}

.identity-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.identity-text,
.flyout-user-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.flyout-user,
.menu-item {
  cursor: pointer;
  font-size: 13px;
}

.flyout-user:hover,
.menu-item:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.flyout-check {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
}

.menu-item--settings {
  margin-top: 4px;
  margin-bottom: 4px;
  border-top: 1px solid var(--g2-border-color-light, #ececec);
  border-bottom: 1px solid var(--g2-border-color-light, #ececec);
  border-radius: 0;
}
</style>

<style>
.sidebar-account-popper.el-popper {
  border-radius: 14px;
  padding: 6px;
  overflow: visible;
}
</style>
