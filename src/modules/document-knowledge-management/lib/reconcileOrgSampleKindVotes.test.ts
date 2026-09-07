import { describe, expect, it } from 'vitest'
import { reconcileOrgSampleKindVotes, type WorkspaceSampleKindVote } from './reconcileOrgSampleKindVotes'

function vote(partial: Partial<WorkspaceSampleKindVote> & Pick<WorkspaceSampleKindVote, 'workspaceId' | 'workspaceName' | 'role'>): WorkspaceSampleKindVote {
  return {
    hasGoldSet: false,
    kind: 'unknown',
    confidence: 0,
    reason: '',
    ...partial,
  }
}

describe('reconcileOrgSampleKindVotes', () => {
  const home = vote({
    workspaceId: 'home',
    workspaceName: 'Adira Finance WS',
    role: 'home',
    hasGoldSet: true,
    kind: 'memo_internal',
    confidence: 0.8,
  })

  it('falls back to Organization when sibling Samples are empty', () => {
    const emptyOverlay = vote({
      workspaceId: 'credit',
      workspaceName: 'Credit System',
      role: 'overlay',
    })
    const result = reconcileOrgSampleKindVotes(home, [emptyOverlay])
    expect(result.outcome).toBe('auto')
    expect(result.kind).toBe('memo_internal')
    expect(result.source).toBe('organization_fallback')
  })

  it('auto-applies when Organization and siblings agree', () => {
    const overlay = vote({
      workspaceId: 'credit',
      workspaceName: 'Credit System',
      role: 'overlay',
      hasGoldSet: true,
      kind: 'memo_internal',
      confidence: 0.7,
    })
    const result = reconcileOrgSampleKindVotes(home, [overlay])
    expect(result.outcome).toBe('auto')
    expect(result.kind).toBe('memo_internal')
    expect(result.source).toBe('org_consensus')
  })

  it('asks the user when kinds differ', () => {
    const overlay = vote({
      workspaceId: 'credit',
      workspaceName: 'Credit System',
      role: 'overlay',
      hasGoldSet: true,
      kind: 'ketetapan_sementara',
      confidence: 0.72,
    })
    const result = reconcileOrgSampleKindVotes(home, [overlay])
    expect(result.outcome).toBe('conflict')
    if (result.outcome !== 'conflict') return
    expect(result.choices.map((choice) => choice.kind).sort()).toEqual(['ketetapan_sementara', 'memo_internal'])
  })
})
