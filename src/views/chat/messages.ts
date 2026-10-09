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
