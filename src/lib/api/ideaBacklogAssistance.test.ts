import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateIdeaDescriptionWithAI } from './ideaBacklogApi'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('./httpClient', () => ({ apiFetch, tectonaServiceHeaders: () => ({}) }))

afterEach(() => { apiFetch.mockReset() })

describe('Idea assistance response parsing', () => {
  it.each([
    [{ response: '  Plain answer  ' }, 'Plain answer'],
    [{ response: JSON.stringify({ result: 'Root result', data: { answer: 'Nested answer' } }) }, 'Root result'],
    [{ response: { data: { text: 'Data text' }, response: { answer: 'Response answer' } } }, 'Data text'],
    [{ response: { envelope: [{ content: 'Array answer' }] } }, 'Array answer'],
    [{ response: '```text\nFenced text\n```' }, 'Fenced text'],
    [{ response: { metadata: true } }, '{"metadata":true}'],
    [null, '""'],
  ])('preserves extraction or fallback text for %j', async (payload, expected) => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify(payload)))
    await expect(generateIdeaDescriptionWithAI('improve_writing', 'Synthetic idea'))
      .resolves.toEqual({ mode: 'improve_writing', result: expected })
  })

  it('still rejects a runtime fallback instead of using it as idea content', async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ response: { answer: 'llm_fallback_used' } })))
    await expect(generateIdeaDescriptionWithAI('improve_writing', 'Synthetic idea'))
      .rejects.toThrow('AI response was a fallback reply')
  })
})
