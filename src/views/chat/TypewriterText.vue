<template>
  <span>{{ done ? text : shown }}</span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** 挂载时逐字展示一次；之后文本不变，不会重播 */
const props = defineProps<{ text: string }>()

const shown = ref('')
const done = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  let length = 0
  timer = setInterval(() => {
    length += 1
    shown.value = props.text.slice(0, length)
    if (length >= props.text.length && timer) {
      clearInterval(timer)
      timer = null
      done.value = true
    }
  }, 60)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>
