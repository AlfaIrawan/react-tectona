import type { GenAiChatSessionSummary } from '@/lib/api/tectonaAgentRuntimeApi'

export type GenAiSessionConversationFields = {
  id: string
  title: string
  preview: string
  updatedAt: number
  aiFolderName?: string
  assistantId?: string | null
}

export function apiGenAiSessionToConversation(
  row: GenAiChatSessionSummary,
  aiFolderName?: string,
): GenAiSessionConversationFields {
  const updatedAt = Number.isFinite(Date.parse(row.updated_at))
    ? Date.parse(row.updated_at)
    : Date.now()
  const assistantId = row.assistant_id?.trim() || undefined
  return {
    id: row.session_id,
    title: row.title || 'Percakapan baru',
    preview: row.preview || 'Belum ada pesan',
    updatedAt,
    ...(assistantId ? { assistantId } : {}),
    ...(aiFolderName ? { aiFolderName } : {}),
  }
}

export function sortGenAiSessionsByUpdatedAt<T extends { updatedAt: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt)
}
