<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    :class="{ 'is-expanded': expanded }"
  >
    <path
      d="M5.629 12.629a.525.525 0 1 0 .742.742l4.765-4.765a.86.86 0 0 0 0-1.212L6.37 2.629a.525.525 0 1 0-.742.742L10.258 8z"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  expanded?: boolean
}>()
</script>

<style scoped>
svg {
  transition: transform 0.15s ease;
}

svg.is-expanded {
  transform: rotate(90deg);
}
</style>
