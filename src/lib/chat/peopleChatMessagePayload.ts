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

function asWireAttachments(value: unknown): PeopleChatWireAttachment[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is PeopleChatWireAttachment =>
      Boolean(item && typeof item === 'object' && typeof (item as PeopleChatWireAttachment).url === 'string'),
  )
}

function parsePeopleChatJson(jsonText: string): {
  text: string
  attachments: PeopleChatWireAttachment[]
} | null {
  try {
    const parsed = JSON.parse(jsonText) as { text?: unknown; attachments?: unknown }
    if (!parsed || typeof parsed !== 'object') return null
    const attachments = asWireAttachments(parsed.attachments)
    if (attachments.length === 0 && typeof parsed.text !== 'string') return null
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      attachments,
    }
  } catch {
    return null
  }
}

function normalizePeopleChatWire(body: string): string {
  let raw = body.replace(/^\uFEFF/, '').trim()
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    try {
      const unquoted = JSON.parse(raw)
      if (typeof unquoted === 'string') raw = unquoted.trim()
    } catch {
      // keep original
    }
  }
  const idx = raw.indexOf(PEOPLE_CHAT_PAYLOAD_PREFIX)
  if (idx > 0) raw = raw.slice(idx)
  return raw
}

export function decodePeopleChatBody(body: string | null | undefined): {
  text: string
  attachments: PeopleChatWireAttachment[]
} {
  const original = body ?? ''
  const raw = normalizePeopleChatWire(original)
  if (raw.startsWith(PEOPLE_CHAT_PAYLOAD_PREFIX)) {
    return parsePeopleChatJson(raw.slice(PEOPLE_CHAT_PAYLOAD_PREFIX.length)) ?? { text: original, attachments: [] }
  }
  if (raw.startsWith('{')) {
    const parsed = parsePeopleChatJson(raw)
    if (parsed?.attachments.length) return parsed
  }
  return { text: original, attachments: [] }
}

export function peopleChatPreview(body: string | null | undefined, maxLen = 72): string {
  const { text, attachments } = decodePeopleChatBody(body)
  const trimmed = text.trim()
  if (trimmed && !trimmed.startsWith(PEOPLE_CHAT_PAYLOAD_PREFIX)) {
    return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen)}…`
  }
  if (attachments.some((item) => item.kind === 'image')) return 'Photo'
  if (attachments.some((item) => item.kind === 'audio')) return 'Voice message'
  if (attachments.length === 1) return attachments[0]?.name?.trim() || 'Attachment'
  if (attachments.length > 1) return `${attachments.length} attachments`
  return ''
}

export type PeopleChatUiAttachment = {
  id: string
  kind: 'image' | 'document' | 'audio' | 'video' | 'contact' | 'poll' | 'event' | string
  name: string
  url: string
  mimeType?: string
  subtitle?: string
  eventDescription?: string
  eventLocation?: string
}

function asUiAttachmentKind(kind: string): PeopleChatUiAttachment['kind'] {
  if (
    kind === 'image' ||
    kind === 'document' ||
    kind === 'audio' ||
    kind === 'video' ||
    kind === 'contact' ||
    kind === 'poll' ||
    kind === 'event'
  ) {
    return kind
  }
  return 'document'
}

/** Decode a stored People-chat body so bubbles can render images even if mapping was skipped. */
export function materializePeopleChatUiMessage<T extends { text: string; attachments?: PeopleChatUiAttachment[] }>(
  message: T,
): T {
  const decoded = decodePeopleChatBody(message.text)
  if (!decoded.attachments.length && decoded.text === message.text) return message
  const existing = message.attachments ?? []
  const seen = new Set(existing.map((item) => item.url))
  const extra: PeopleChatUiAttachment[] = decoded.attachments
    .filter((item) => item.url && !seen.has(item.url))
    .map((item) => ({
      id: item.id,
      kind: asUiAttachmentKind(String(item.kind || 'document')),
      name: item.name,
      url: item.url,
      ...(item.mimeType ? { mimeType: item.mimeType } : {}),
      ...(item.subtitle ? { subtitle: item.subtitle } : {}),
      ...(item.eventDescription ? { eventDescription: item.eventDescription } : {}),
      ...(item.eventLocation ? { eventLocation: item.eventLocation } : {}),
    }))
  return {
    ...message,
    text: decoded.text,
    ...(existing.length + extra.length > 0 ? { attachments: [...existing, ...extra] } : {}),
  }
}
