import { describe, expect, it } from 'vitest'
import {
  decodePeopleChatBody,
  encodePeopleChatBody,
  materializePeopleChatUiMessage,
  peopleChatPreview,
} from './peopleChatMessagePayload'

describe('peopleChatMessagePayload', () => {
  it('leaves plain text unchanged', () => {
    expect(encodePeopleChatBody('hello', [])).toBe('hello')
    expect(decodePeopleChatBody('hello')).toEqual({ text: 'hello', attachments: [] })
    expect(peopleChatPreview('hello')).toBe('hello')
  })

  it('round-trips image captions and attachments', () => {
    const wire = encodePeopleChatBody('lihat ini', [
      { id: 'a1', kind: 'image', name: 'shot.png', url: 'https://example/shot.png', mimeType: 'image/png' },
    ])
    const decoded = decodePeopleChatBody(wire)
    expect(decoded.text).toBe('lihat ini')
    expect(decoded.attachments).toHaveLength(1)
    expect(decoded.attachments[0]?.url).toContain('shot.png')
    expect(peopleChatPreview(wire)).toBe('lihat ini')
  })

  it('previews image-only messages as Photo', () => {
    const wire = encodePeopleChatBody('', [
      { id: 'a1', kind: 'image', name: 'shot.png', url: 'https://example/shot.png' },
    ])
    expect(peopleChatPreview(wire)).toBe('Photo')
  })

  it('decodes payloads with leading whitespace', () => {
    const wire = `  ${encodePeopleChatBody('', [
      { id: 'a1', kind: 'image', name: 'shot.png', url: 'https://minio.example/shot.png' },
    ])}`
    const decoded = decodePeopleChatBody(wire)
    expect(decoded.attachments).toHaveLength(1)
    expect(decoded.text).toBe('')
  })

  it('materializes encoded text into image attachments', () => {
    const wire = encodePeopleChatBody('', [
      { id: 'a1', kind: 'image', name: 'shot.png', url: 'https://minio.example/shot.png' },
    ])
    const materialized = materializePeopleChatUiMessage({ id: 'm1', text: wire })
    expect(materialized.text).toBe('')
    expect(materialized.attachments?.[0]?.kind).toBe('image')
    expect(materialized.attachments?.[0]?.url).toContain('shot.png')
  })
})
