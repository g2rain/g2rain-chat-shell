import type { ChatMessageItem, ChatMessageRecord } from './type'

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
    }))
}

/** 12s / 1m 05s */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}
