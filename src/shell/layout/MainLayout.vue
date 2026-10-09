<template>
  <!-- Bare auth pages: no shell chrome (align main-shell MainLayout). -->
  <router-view v-if="isBareAuthRoute" />

  <div v-else class="app-container">
    <div class="app-main">
      <ChatPage />
    </div>
    <Footer />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Footer from './Footer.vue'
import { ChatPage } from '../../views'

const route = useRoute()

/** SSO / logout must not render Workspace chrome. */
const isBareAuthRoute = computed(
  () => route.meta.bare === true || route.path.endsWith('/sso_callback') || route.path.endsWith('/logout'),
)
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--g2-bg-container);
}

.app-main {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

</style>
