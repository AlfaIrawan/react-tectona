import { describe, expect, it } from 'vitest'
import { indexIdeaDraftSessions, isActiveIdeaDraft } from './ideaDraftSessionIndex'
import type { IdeaDraftBrainstormPointer } from '@/stores/idea-draft-brainstorm-pointer-store'
import { workspaceScopedPath } from '@/lib/workspaceRouting'

const session: IdeaDraftBrainstormPointer = { jobId: 'job', draftSessionId: 'session', title: 'Draft',
  ownerId: 'alice', workspaceId: 'target', sourceWorkspaceId: 'origin', updatedAt: 1, status: 'awaiting_input' }

describe('brainstorm source workspace visibility', () => {
  it('can reopen the session without leaving the current source workspace route', () => {
    expect(workspaceScopedPath('alfa-irawan-ws', '/idea-backlog', 'origin')).toBe('/w/alfa-irawan-ws/idea-backlog')
  })
  it.each(['queued', 'running', 'awaiting_input', 'completed'])('keeps %s visible at its origin and target', status => {
    const item = { ...session, status }
    expect(indexIdeaDraftSessions([item], 'alice', ['origin'])).toEqual([item])
    expect(indexIdeaDraftSessions([item], 'alice', ['target'])).toEqual([item])
    expect(isActiveIdeaDraft(item)).toBe(true)
  })
  it('does not show another user session or an unrelated workspace', () => {
    expect(indexIdeaDraftSessions([session], 'bob', ['origin'])).toEqual([])
    expect(indexIdeaDraftSessions([session], 'alice', ['unrelated'])).toEqual([])
  })
  it('retains created-idea history in the source workspace', () => {
    const created = { ...session, ideaId: 'idea-1', status: 'completed' }
    expect(indexIdeaDraftSessions([created], 'alice', ['origin'])).toEqual([created])
    expect(isActiveIdeaDraft(created)).toBe(false)
  })
  it('does not guess an origin for legacy sessions', () => {
    const legacy = { ...session, sourceWorkspaceId: undefined }
    expect(indexIdeaDraftSessions([legacy], 'alice', ['origin'])).toEqual([])
    expect(indexIdeaDraftSessions([legacy], 'alice', ['target'])).toEqual([legacy])
  })
  it('deduplicates a session selected through both workspaces', () => {
    expect(indexIdeaDraftSessions([session, { ...session, updatedAt: 2 }], 'alice', ['origin', 'target'])).toHaveLength(1)
  })
})
