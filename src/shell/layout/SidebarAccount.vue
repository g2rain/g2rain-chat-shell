<template>
  <div class="sidebar-account" :class="{ collapsed }">
    <el-dropdown
      trigger="click"
      :placement="collapsed ? 'right-end' : 'top-start'"
      popper-class="sidebar-account-popper"
      @command="handleCommand"
    >
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

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item disabled class="menu-user-plain">
            <div class="menu-user">
              <span class="avatar sm">{{ userInitial }}</span>
              <span class="menu-user__text">
                <span class="menu-user__name">{{ displayName }}</span>
                <span v-if="isLoggedIn && organ?.name" class="menu-user__sub">{{ organ.name }}</span>
              </span>
            </div>
          </el-dropdown-item>

          <template v-if="canSwitchOrgan">
            <el-dropdown-item disabled divided class="menu-section">切换机构</el-dropdown-item>
            <el-dropdown-item
              v-for="item in availableOrgans"
              :key="item.organCode"
              :command="`organ:${item.organCode}`"
              :class="{ 'is-active': organ?.organCode === item.organCode }"
            >
              <span class="organ-item">
                <span>{{ item.name }}</span>
                <span v-if="organ?.organCode === item.organCode" class="organ-check">✓</span>
              </span>
            </el-dropdown-item>
          </template>

          <el-dropdown-item command="settings" divided>
            <el-icon><Setting /></el-icon>
            <span>设置</span>
          </el-dropdown-item>
          <el-dropdown-item command="passport" :disabled="!isLoggedIn">
            <el-icon><User /></el-icon>
            <span>账号管理</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="isLoggedIn" command="logout" divided>
            <el-icon><SwitchButton /></el-icon>
            <span>退出登录</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <ShellSettingsDialog v-model="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Setting, SwitchButton, User } from '@element-plus/icons-vue'
import { useSessionStore } from '../../platform/stores/session.store'
import { useAccessTokenStore } from '../../platform/stores/token.store'
import { useMenuStore } from '../../platform/stores/menu.store'
import { useRuntimeStore } from '../../platform/stores/runtime.store'
import { useWorkspaceStore } from '../../platform/stores/workspace.store'
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
const workspace = useWorkspaceStore()

const { user, organ, availableOrgans, isLoggedIn } = storeToRefs(session)
const settingsOpen = ref(false)

const displayName = computed(() => {
  if (!isLoggedIn.value || !user.value) return '游客'
  return user.value.displayName || user.value.account || '用户'
})

const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())

/** 多于 1 个机构才显示切换列表（对齐截图里的多账号切换） */
const canSwitchOrgan = computed(() => availableOrgans.value.length > 1)

async function handleCommand(command: string): Promise<void> {
  if (command.startsWith('organ:')) {
    session.switchOrgan(command.slice('organ:'.length))
    return
  }
  if (command === 'settings') {
    settingsOpen.value = true
    return
  }
  if (command === 'passport') {
    workspace.openShellView({
      viewId: 'shell.passport',
      title: '账号管理',
      kind: 'shell',
      closable: true,
      shellPage: 'passport',
    })
    return
  }
  if (command !== 'logout') return
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
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  margin-top: auto;
  padding: 8px 8px 12px;
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
</style>

<style>
.sidebar-account-popper.el-dropdown__popper {
  border-radius: 14px;
  overflow: hidden;
}

.sidebar-account-popper .el-dropdown-menu {
  min-width: 220px;
  padding: 6px;
  border-radius: 14px;
}

.sidebar-account-popper .el-dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 8px 12px;
  line-height: 1.35;
}

.sidebar-account-popper .el-dropdown-menu__item.is-active {
  color: var(--g2-color-primary);
  font-weight: 600;
}

.sidebar-account-popper .menu-user {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.sidebar-account-popper .menu-user .avatar.sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--g2-color-primary) 18%, transparent);
  color: var(--g2-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.sidebar-account-popper .menu-user__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.sidebar-account-popper .menu-user__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--g2-text-primary);
}

.sidebar-account-popper .menu-user__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--g2-text-secondary);
  font-weight: 400;
}

.sidebar-account-popper .menu-user-plain {
  cursor: default;
  opacity: 1;
}

.sidebar-account-popper .menu-section {
  font-size: 12px;
  color: var(--g2-text-secondary);
  cursor: default;
}

.sidebar-account-popper .organ-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.sidebar-account-popper .organ-check {
  color: var(--g2-color-primary);
  font-size: 13px;
}
</style>
