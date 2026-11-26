<template>
  <div class="logout-page">
    <div class="logout-container">
      <div class="logo-section">
        <h1 class="app-title">{{ $t('MS_HDR_LOGO', '谷雨开源SaaS平台') }}</h1>
        <p class="app-subtitle">{{ $t('MS_AU_LOGOUT_SUB', '企业级应用管理解决方案') }}</p>
      </div>

      <div class="content-section">
        <div class="logout-icon">
          <el-icon :size="64" color="var(--g2-color-primary)">
            <User />
          </el-icon>
        </div>
        <h2 class="logout-title">{{ $t('MS_AU_LOGOUT_TITLE', '您已安全退出') }}</h2>
        <p class="logout-description">
          {{ $t('MS_AU_LOGOUT_DESC_PREFIX', '感谢您使用 谷雨开源SaaS平台。您的账户已在本应用退出，如果要彻底退出请访问') }}
          <a href="javascript:void(0);" class="sso-link" @click.prevent="gotoSsoIndex">
            {{ $t('MS_AU_IAM_LINK', '谷雨开源SaaS平台 IAM系统') }}
          </a>
          {{ $t('MS_AU_LOGOUT_DESC_SUFFIX', '，系统将在') }} {{ countdown }}
          {{ $t('G2_AU_LOGOUT_COUNTDOWN', '秒后自动跳转。') }}
        </p>
        <p class="logout-tip">
          {{ $t('MS_AU_LOGOUT_TIP', '如需继续使用，请重新登录。') }}
        </p>
      </div>

      <div class="action-section">
        <el-button type="primary" size="large" class="login-button" @click="relogin">
          <el-icon><Lock /></el-icon>
          {{ $t('MS_AU_RELOGIN', '重新登录') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Lock, User } from '@element-plus/icons-vue'
import { sso } from '../../runtime/auth/sso'

const countdown = ref(5)
let timer: number | null = null

function relogin(): void {
  void sso.redirectToSSO()
}

function gotoSsoIndex(): void {
  void sso.redirectToSSOIndex()
}

onMounted(() => {
  timer = window.setInterval(() => {
    if (countdown.value > 1) {
      countdown.value -= 1
      return
    }
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
    void sso.redirectToSSOIndex()
  }, 1000)
})

onUnmounted(() => {
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
.logout-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: var(--g2-space-lg);
  background: linear-gradient(135deg, var(--g2-bg-page) 0%, var(--g2-bg-muted) 100%);
}

.logout-container {
  width: 100%;
  max-width: 500px;
  padding: var(--g2-space-xl);
  border-radius: var(--g2-border-radius-lg);
  background-color: var(--g2-bg-container);
  box-shadow: var(--g2-shadow-base);
  text-align: center;
}

.logo-section {
  margin-bottom: var(--g2-space-xl);
  padding-bottom: var(--g2-space-lg);
  border-bottom: 1px solid var(--g2-border-color);
}

.app-title {
  margin: 0 0 var(--g2-space-xs);
  color: var(--g2-text-primary);
  font-size: 24px;
  font-weight: 700;
}

.app-subtitle {
  margin: 0;
  color: var(--g2-text-secondary);
  font-size: var(--g2-font-size-sm);
}

.content-section {
  margin: var(--g2-space-xl) 0;
}

.logout-icon {
  display: flex;
  justify-content: center;
  margin-bottom: var(--g2-space-lg);
}

.logout-title {
  margin: 0 0 var(--g2-space-md);
  color: var(--g2-text-primary);
  font-size: 20px;
  font-weight: 600;
}

.logout-description {
  margin: 0 0 var(--g2-space-sm);
  color: var(--g2-text-secondary);
  font-size: var(--g2-font-size-base);
  line-height: 1.6;
}

.logout-tip {
  margin: 0;
  color: var(--g2-text-placeholder);
  font-size: var(--g2-font-size-sm);
}

.sso-link {
  color: var(--g2-color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.action-section {
  margin-top: var(--g2-space-xl);
  padding-top: var(--g2-space-lg);
  border-top: 1px solid var(--g2-border-color);
}

.login-button {
  width: 100%;
  padding: var(--g2-space-md);
  font-size: var(--g2-font-size-base);
  font-weight: 500;
}

.login-button :deep(.el-icon) {
  margin-right: var(--g2-space-xs);
}
</style>
