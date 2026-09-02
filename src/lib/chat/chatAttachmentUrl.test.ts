import { describe, expect, it } from 'vitest'
import {
  CHAT_ATTACHMENT_OBJECTS_PREFIX,
  chatAttachmentDisplayUrl,
  toBrowserChatAttachmentUrl,
} from './chatAttachmentUrl'

describe('toBrowserChatAttachmentUrl', () => {
  it('rewrites MinIO public URLs to the same-origin proxy', () => {
    const objectName =
      'chat/react-tectona/session-1/20260902T142159Z-abc123-context-evidence-20260902-212159.png'
    expect(
      toBrowserChatAttachmentUrl(
        `http://minio-dev.adira.co.id/tectona-chat-attachments/${objectName}`,
      ),
    ).toBe(`${CHAT_ATTACHMENT_OBJECTS_PREFIX}${objectName}`)
  })

  it('keeps data URLs for local screenshot previews', () => {
    const dataUrl = 'data:image/png;base64,abc'
    expect(toBrowserChatAttachmentUrl(dataUrl)).toBe(dataUrl)
  })

  it('prefers a local data preview when rendering', () => {
    expect(
      chatAttachmentDisplayUrl({
        url: 'http://minio-dev.adira.co.id/tectona-chat-attachments/chat/x/y/z.png',
        previewUrl: 'data:image/png;base64,abc',
      }),
    ).toBe('data:image/png;base64,abc')
  })
})
