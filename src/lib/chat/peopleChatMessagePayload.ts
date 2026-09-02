/** Wire format for People (DM/group) messages that include attachments. */

export const PEOPLE_CHAT_PAYLOAD_PREFIX = 'TECTONA_CHAT_V1:'

export type PeopleChatWireAttachment = {
  id: string
  kind: 'image' | 'document' | 'audio' | 'video' | 'contact' | 'poll' | 'event' | string
  name: string
  url: string
  mimeType?: string
  subtitle?: string
  eventDescription?: string
  eventLocation?: string
}

export function encodePeopleChatBody(text: string, attachments: PeopleChatWireAttachment[]): string {
  if (!attachments.length) return text
  return `${PEOPLE_CHAT_PAYLOAD_PREFIX}${JSON.stringify({ text, attachments })}`
}

export function decodePeopleChatBody(body: string | null | undefined): {
  text: string
  attachments: PeopleChatWireAttachment[]
} {
  const raw = body ?? ''
  if (!raw.startsWith(PEOPLE_CHAT_PAYLOAD_PREFIX)) {
    return { text: raw, attachments: [] }
  }
  try {
    const parsed = JSON.parse(raw.slice(PEOPLE_CHAT_PAYLOAD_PREFIX.length)) as {
      text?: unknown
      attachments?: unknown
    }
    const attachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.filter(
          (item): item is PeopleChatWireAttachment =>
            Boolean(item && typeof item === 'object' && typeof (item as PeopleChatWireAttachment).url === 'string'),
        )
      : []
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      attachments,
    }
  } catch {
    return { text: raw, attachments: [] }
  }
}

export function peopleChatPreview(body: string | null | undefined, maxLen = 72): string {
  const { text, attachments } = decodePeopleChatBody(body)
  const trimmed = text.trim()
  if (trimmed) {
    return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen)}…`
  }
  if (attachments.some((item) => item.kind === 'image')) return 'Photo'
  if (attachments.some((item) => item.kind === 'audio')) return 'Voice message'
  if (attachments.length === 1) return attachments[0]?.name?.trim() || 'Attachment'
  if (attachments.length > 1) return `${attachments.length} attachments`
  return ''
}
