import { describe, expect, it } from 'vitest'

import { apiGenAiSessionToConversation } from './genAiSessionMapper'

describe('apiGenAiSessionToConversation', () => {
  it('keeps explainer assistant_id so reopen continues with the same pack', () => {
    const mapped = apiGenAiSessionToConversation({
      session_id: 'genai-vanya',
      title: 'Dokumen apa yang kamu tau?',
      preview: 'Berdasarkan BLOK_DOKUMEN',
      updated_at: '2026-09-14T06:03:00.000Z',
      assistant_id: 'vanya-p2d',
    })
    expect(mapped.id).toBe('genai-vanya')
    expect(mapped.assistantId).toBe('vanya-p2d')
  })

  it('omits assistantId for default Smith sessions', () => {
    const mapped = apiGenAiSessionToConversation({
      session_id: 'genai-smith',
      title: 'New conversation',
      preview: 'Hi',
      updated_at: '2026-09-14T06:03:00.000Z',
    })
    expect(mapped.assistantId).toBeUndefined()
  })
})
