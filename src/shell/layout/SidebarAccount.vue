<template>
  <div class="sidebar-account" :class="{ collapsed }">
    <!-- 访客：显示访客身份与所属机构，右侧"登录"；不弹菜单（访客没有设置与退出） -->
    <template v-if="isVisitor">
      <div class="profile-trigger visitor-row" :class="{ collapsed }">
        <button
          v-if="collapsed"
          type="button"
          class="avatar avatar-button"
          title="访客，点击登录"
          aria-label="登录"
          @click="login"
        >访</button>
        <template v-else>
          <span class="avatar">访</span>
          <span class="profile-name">
            访客<span v-if="organ?.name" class="visitor-organ"> · {{ organ.name }}</span>
          </span>
          <button type="button" class="visitor-login" @click="login">登录</button>
        </template>
      </div>
      <p v-if="!collapsed && !tokenStore.persistable" class="visitor-hint">
        当前浏览器无法保存访客记录，关闭页面后对话将丢失
      </p>
    </template>

    <!-- 尚未取得任何身份（通常正在跳转授权） -->
    <button
      v-else-if="!isLoggedIn"
      type="button"
      class="profile-trigger"
      :class="{ collapsed }"
      title="登录"
      aria-label="登录"
      @click="login"
    >
      <span class="avatar"><el-icon><User /></el-icon></span>
      <span v-if="!collapsed" class="profile-name">登录</span>
    </button>

    <el-popover
      v-else
      v-model:visible="menuOpen"
      :placement="collapsed ? 'right-end' : 'top-start'"
      :width="280"
      trigger="click"
      :hide-after="0"
      popper-class="sidebar-account-popper"
      @show="onMenuShow"
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
        <!-- 一级：机构卡，右侧 >；hover（触屏为点击）出二级身份列表 -->
        <div
          class="organ-card"
          @mouseenter="onOrganEnter"
          @mouseleave="onOrganLeave"
          @click="onOrganClick"
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
              :class="{ active: item.current }"
              :disabled="switching"
              @click="selectUser(item)"
            >
              <span class="avatar sm">{{ item.initial }}</span>
              <span class="flyout-user-text">
                <span class="flyout-user-name">{{ item.label }}</span>
                <span v-if="item.sub" class="flyout-user-sub">{{ item.sub }}</span>
              </span>
              <span v-if="item.current" class="flyout-check">✓</span>
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
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowRight, Setting, SwitchButton, User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSessionStore } from '../../platform/stores/session.store'
import { useAccessTokenStore } from '../../platform/stores/token.store'
import { useMenuStore } from '../../platform/stores/menu.store'
import { useRuntimeStore } from '../../platform/stores/runtime.store'
import {
  clearReturnUrl,
  resetNavigationRestoreState,
} from '../../runtime/navigation/sub-app-redirect'
import { sso } from '../../runtime/auth/sso'
import { listIdentities, type UserIdentityVo } from '../../runtime/api/user-identity'
import ShellSettingsDialog from './ShellSettingsDialog.vue'

defineProps<{
  collapsed?: boolean
}>()

const router = useRouter()
const session = useSessionStore()
const runtimeStore = useRuntimeStore()
const tokenStore = useAccessTokenStore()
const menuStore = useMenuStore()

const { user, organ, isLoggedIn, isVisitor } = storeToRefs(session)
const settingsOpen = ref(false)
const menuOpen = ref(false)
const userFlyoutOpen = ref(false)
/** 当前账号在本应用中可切换的身份；每次打开账号菜单时刷新 */
const identities = ref<UserIdentityVo[]>([])
const switching = ref(false)
let closeFlyoutTimer: ReturnType<typeof setTimeout> | null = null

const displayName = computed(() => {
  if (!isLoggedIn.value || !user.value) return '游客'
  return user.value.displayName || user.value.account || '用户'
})

const accountLabel = computed(() => {
  if (!isLoggedIn.value || !user.value) return '未登录'
  return user.value.account || '加载中…'
})

const organName = computed(() => organ.value?.name || '未选择机构')
const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())
const organInitial = computed(() => organName.value.slice(0, 1).toUpperCase())

interface UserChoice {
  key: string
  label: string
  sub: string
  initial: string
  current: boolean
}

/** 二级身份列表：机构名为主、姓名为辅；接口无数据时只展示当前身份 */
const userChoices = computed<UserChoice[]>(() => {
  const currentUserId = tokenStore.token?.userId
  if (identities.value.length === 0) {
    return [{
      key: currentUserId ?? 'current',
      label: organName.value,
      sub: displayName.value,
      initial: organInitial.value,
      current: true,
    }]
  }

  return identities.value.map((item) => {
    const key = String(item.userId)
    const label = item.organName || '未命名机构'
    return {
      key,
      label,
      sub: item.userName || '',
      initial: label.slice(0, 1).toUpperCase(),
      current: key === currentUserId,
    }
  })
})

/** 打开账号菜单：补齐登录账号，并刷新可切换身份 */
function onMenuShow(): void {
  void session.loadAccount()
  void loadIdentities()
}

async function loadIdentities(): Promise<void> {
  try {
    identities.value = await listIdentities()
  } catch (error) {
    console.warn('[account] failed to load identities:', error)
  }
}

/** 触屏没有 hover：轻触会补发 mouseenter，展开 / 收起只认点击 */
function isTouch(): boolean {
  return window.matchMedia('(hover: none)').matches
}

function onOrganEnter(): void {
  if (!isTouch()) openUserFlyout()
}

function onOrganLeave(): void {
  if (!isTouch()) scheduleCloseUserFlyout()
}

function onOrganClick(): void {
  if (isTouch()) {
    userFlyoutOpen.value = !userFlyoutOpen.value
    return
  }
  openUserFlyout()
}

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

/**
 * 切换到同账号下的其他身份：换票成功后整页回到首页，会话、模型与路由选项随之重置。
 */
async function selectUser(item: UserChoice): Promise<void> {
  if (item.current || switching.value) return
  switching.value = true
  try {
    await sso.switchToken(item.key)
    menuOpen.value = false
    window.location.assign(router.resolve('/').href)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : '切换失败，请稍后再试'
    ElMessage.error(message)
    switching.value = false
  }
}

function openSettings(): void {
  menuOpen.value = false
  settingsOpen.value = true
}

function login(): void {
  void sso.redirectToSSO()
}

/**
 * 退出登录：保留密钥与接入码；开放匿名访问时回到原来的访客身份，否则进入退出页。
 */
async function logout(): Promise<void> {
  menuOpen.value = false
  await runtimeStore.releaseAllOnLogout()
  menuStore.reset()
  clearReturnUrl()
  resetNavigationRestoreState()
  tokenStore.logout()
  session.clearSession()
  if (sso.canAuthorizeAnonymous()) {
    await sso.authorizeAnonymous()
    return
  }
  await router.push('/logout')
}
</script>

<style scoped>
.visitor-row {
  cursor: default;
}

.visitor-row:hover {
  background: transparent;
}

.visitor-organ {
  color: var(--g2-text-secondary);
}

.visitor-login {
  flex-shrink: 0;
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid var(--g2-border-color, #dcdfe6);
  border-radius: 8px;
  background: transparent;
  color: var(--g2-text-primary);
  font-size: 13px;
  cursor: pointer;
}

.visitor-login:hover {
  background: color-mix(in srgb, var(--g2-text-primary) 6%, transparent);
}

.avatar-button {
  border: none;
  cursor: pointer;
}

.visitor-hint {
  margin: 4px 10px 0;
  color: var(--g2-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

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
  z-index: 20;
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

.flyout-user-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.flyout-user-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--g2-text-secondary);
}

.flyout-user:disabled {
  cursor: progress;
  opacity: 0.6;
}

.flyout-check {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
}

/* 触屏：二级列表改为在机构卡下方展开，不向右飞出屏幕 */
@media (hover: none) {
  .organ-card {
    flex-wrap: wrap;
  }

  .user-flyout {
    position: static;
    flex-basis: 100%;
    width: 100%;
    margin-top: 6px;
    padding: 0;
    border: none;
    box-shadow: none;
  }

  .user-flyout::before {
    display: none;
  }

  .flyout-user {
    min-height: 44px;
  }
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
  z-index: 3000 !important;
  border-radius: 14px;
  padding: 6px;
  overflow: visible;
}
</style>
