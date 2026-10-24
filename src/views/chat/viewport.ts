import { onBeforeUnmount, ref, type Ref } from 'vue'

/** 低于该宽度（手机与平板竖屏）侧栏改为抽屉，并显示顶栏 */
export const COMPACT_QUERY = '(max-width: 1023px)'

/**
 * 当前是否为紧凑布局；随窗口尺寸与转屏实时更新。
 *
 * @example
 * const compact = useCompact()
 * if (compact.value) drawerOpen.value = false
 */
export function useCompact(): Ref<boolean> {
  const query = window.matchMedia?.(COMPACT_QUERY)
  const compact = ref(query?.matches ?? false)
  const onChange = (event: MediaQueryListEvent): void => {
    compact.value = event.matches
  }
  query?.addEventListener('change', onChange)
  onBeforeUnmount(() => query?.removeEventListener('change', onChange))
  return compact
}
