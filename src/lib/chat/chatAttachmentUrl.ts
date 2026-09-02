/** Same-origin proxy for chat files stored in MinIO. */
export const CHAT_ATTACHMENT_OBJECTS_PREFIX =
  '/api/tectona-agent-runtime/v1/chat/attachments/objects/'

const DEFAULT_BUCKET = 'tectona-chat-attachments'

/**
 * Direct MinIO HTTP URLs are mixed-content blocked on https://tectona-dev.
 * Rewrite them to the agent-runtime proxy the SPA already serves.
 */
export function toBrowserChatAttachmentUrl(url: string): string {
  const trimmed = (url || '').trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed
  if (trimmed.startsWith(CHAT_ATTACHMENT_OBJECTS_PREFIX)) return trimmed

  let pathname = ''
  try {
    pathname = new URL(trimmed, 'https://placeholder.invalid').pathname
  } catch {
    pathname = trimmed.startsWith('/') ? trimmed : ''
  }

  const parts = pathname.split('/').filter(Boolean)
  const bucketIdx = parts.findIndex((part) => part === DEFAULT_BUCKET)
  if (bucketIdx >= 0) {
    const objectName = parts.slice(bucketIdx + 1).join('/')
    if (objectName.startsWith('chat/')) {
      return `${CHAT_ATTACHMENT_OBJECTS_PREFIX}${objectName}`
    }
  }

  const objectsIdx = parts.findIndex(
    (part, index) => part === 'objects' && parts[index - 1] === 'attachments',
  )
  if (objectsIdx >= 0) {
    const objectName = parts.slice(objectsIdx + 1).join('/')
    if (objectName.startsWith('chat/')) {
      return `${CHAT_ATTACHMENT_OBJECTS_PREFIX}${objectName}`
    }
  }

  if (trimmed.startsWith('http://')) {
    try {
      const upgraded = new URL(trimmed)
      upgraded.protocol = 'https:'
      return upgraded.toString()
    } catch {
      return trimmed
    }
  }

  return trimmed
}

export function chatAttachmentDisplayUrl(attachment: {
  url: string
  previewUrl?: string
}): string {
  const preview = attachment.previewUrl?.trim() ?? ''
  if (preview.startsWith('data:') || preview.startsWith('blob:')) return preview
  return toBrowserChatAttachmentUrl(attachment.url)
}
