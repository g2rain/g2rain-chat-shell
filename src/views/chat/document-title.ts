import { onBeforeUnmount, watch, type Ref } from 'vue'

/** 页面原始标题（index.html 的 <title>），模块加载时读取一次，不在业务代码里写死 */
export const baseTitle = document.title

/** 打字机效果的逐字间隔（毫秒） */
const TYPE_INTERVAL = 60

/**
 * 页面标题跟随当前会话：有会话标题时显示会话标题，否则还原页面原始标题；离开页面时还原。
 *
 * - 切换、新建、删除会话只需改变当前会话，标题随之切换，不做动画
 * - `play(title)` 以打字机效果切换，仅用于新会话生成标题；播放中遇到同一标题的切换不会打断
 *
 * @example
 * const { play } = useDocumentTitle(activeTitle)
 * play('谷雨是什么') // 逐字出现
 */
export function useDocumentTitle(title: Ref<string | null | undefined>) {
  let timer: ReturnType<typeof setInterval> | null = null
  let playing: string | null = null

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = null
    playing = null
  }

  function apply(value: string | null | undefined): void {
    if (value && value === playing) return
    stop()
    document.title = value?.trim() || baseTitle
  }

  function play(value: string): void {
    stop()
    playing = value
    let length = 0
    timer = setInterval(() => {
      length += 1
      document.title = value.slice(0, length)
      if (length >= value.length) stop()
    }, TYPE_INTERVAL)
  }

  watch(title, apply, { immediate: true })

  onBeforeUnmount(() => {
    stop()
    document.title = baseTitle
  })

  return { play }
}
