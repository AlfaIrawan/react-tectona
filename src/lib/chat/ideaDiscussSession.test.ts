import { describe, expect, it, vi } from 'vitest'
import { isIdeaDiscussSessionFor, newIdeaDiscussSessionId } from '@/stores/idea-discuss-chat-store'
import { findGenAiConversationForIdea } from './ideaDiscussSession'

const IDEA = '2ccd2c53-0ee1-46fe-8d87-645a555f1b2a'

describe('idea discussion session ids', () => {
  it('are unique per user and per new discussion', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-27T10:00:00Z'))
    const alfa = newIdeaDiscussSessionId(IDEA, '97e9ef1f-cb83-459b-a685-3496f5057ac2')
    const ricky = newIdeaDiscussSessionId(IDEA, 'f03bcdc4-dad7-4c53-97c2-7d3d0aabe581')
    vi.setSystemTime(new Date('2026-09-27T10:05:00Z'))
    const alfaLater = newIdeaDiscussSessionId(IDEA, '97e9ef1f-cb83-459b-a685-3496f5057ac2')
    vi.useRealTimers()
    expect(new Set([alfa, ricky, alfaLater]).size).toBe(3)
    expect(alfa.length).toBeLessThanOrEqual(128)
    expect([alfa, ricky, alfaLater].every((id) => isIdeaDiscussSessionFor(id, IDEA))).toBe(true)
    expect(isIdeaDiscussSessionFor(`genai-idea-${IDEA}x`, IDEA)).toBe(false)
  })

  it('reuses the user own discussion but never a stale legacy per-idea id from local state', () => {
    const own = { id: newIdeaDiscussSessionId(IDEA, 'u1'), mode: 'genai', title: 'Helpdesk' }
    const legacy = { id: `genai-idea-${IDEA}`, mode: 'genai', title: 'Helpdesk' }
    expect(findGenAiConversationForIdea([legacy, own], IDEA, 'Helpdesk')?.id).toBe(own.id)
    expect(findGenAiConversationForIdea([legacy], IDEA, 'Helpdesk')).toBeUndefined()
  })
})
