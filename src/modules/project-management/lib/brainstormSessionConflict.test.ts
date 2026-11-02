import { describe, expect, it, vi } from 'vitest'
import { readBrainstormSessionConflict } from './brainstormSessionConflict'

describe('brainstorm conflict recovery', () => {
  it('reads the latest version on a conflict without replaying the message', async () => {
    const latest = { revision: 'server-revision', brainstorm_messages: [{ role: 'assistant', text: 'Latest question' }] }
    const read = vi.fn().mockResolvedValue(latest)
    expect(await readBrainstormSessionConflict(new Error('409 IDEA_DRAFT_SESSION_CHANGED'), read))
      .toEqual({ kind: 'changed', latest })
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('does not replace the transcript with a partially composed busy turn', async () => {
    const read = vi.fn()
    expect(await readBrainstormSessionConflict(new Error('IDEA_DRAFT_SESSION_BUSY'), read)).toEqual({ kind: 'busy', latest: null })
    expect(read).not.toHaveBeenCalled()
  })
  it('does not recover unrelated API errors', async () => {
    const read = vi.fn()
    expect(await readBrainstormSessionConflict(new Error('AUTHENTICATION_REQUIRED'), read)).toEqual({ kind: null, latest: null })
    expect(read).not.toHaveBeenCalled()
  })
  it('propagates a failed refresh instead of reporting success', async () => {
    await expect(readBrainstormSessionConflict(new Error('IDEA_DRAFT_SESSION_CHANGED'),
      vi.fn().mockRejectedValue(new Error('Unauthorized')))).rejects.toThrow('Unauthorized')
  })
})
