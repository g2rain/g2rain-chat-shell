import type { ChatMessageItem, ChatMessageRecord, TurnStep } from './type'

export function historyToChatItems(rows: ChatMessageRecord[]): ChatMessageItem[] {
  return rows
    .filter((row) => {
      if (row.messageType === 'CONFIRM_CARD') return false
      if (row.role === 'USER') return true
      if (row.role === 'AGENT') return !row.nodeId
      return false
    })
    .sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0))
    .map((row) => ({
      id: row.messageId ?? String(row.id ?? crypto.randomUUID()),
      role: row.role as 'USER' | 'AGENT',
      content: row.content ?? '',
      createdAtMs: row.createdAtMs,
      elapsedMs: row.elapsedMs ?? undefined,
      progress: row.progress?.length ? row.progress : undefined,
      traceId: row.traceId,
      failed: isFailed(row.progress),
    }))
}

/** 顶层步骤有失败即视为本轮失败 */
export function isFailed(steps?: TurnStep[]): boolean {
  return !!steps?.some((step) => !step.parentStepId && step.status === 'FAILED')
}

/** 按 stepId 合并：首次出现追加，再次出现更新同一项 */
export function mergeStep(steps: TurnStep[], step: TurnStep): TurnStep[] {
  const index = steps.findIndex((item) => item.stepId === step.stepId)
  if (index < 0) return [...steps, step]
  const next = steps.slice()
  next[index] = step
  return next
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** 按远近缩写：今天 HH:mm，今年 MM-DD HH:mm，跨年 YYYY-MM-DD HH:mm */
export function formatMessageTime(ms: number): string {
  const date = new Date(ms)
  const now = new Date()
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.toDateString() === now.toDateString()) return time
  const day = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`
  return date.getFullYear() === now.getFullYear() ? day : `${date.getFullYear()}-${day}`
}

/** 悬停展示的完整时间：YYYY-MM-DD HH:mm:ss */
export function formatFullTime(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 12s / 1m 05s */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}
