import { describe, expect, it } from 'vitest'

import { docApprovalState } from './ideaDocApprovals'

const approval = (over: Record<string, unknown> = {}) => ({
  id: 'a1', run_id: 'run-1', workflow_id: 'wf-1', node_id: 'n2', attempt: 1,
  subject_id: 'owner-1', quorum: 'all' as const, status: 'pending' as const,
  subject_context: { document_id: 'doc-1' }, ...over,
})

describe('docApprovalState', () => {
  it('offers Submit only on a draft with nothing pending', () => {
    expect(docApprovalState({ status_code: 'draft' }, [], 'me').canSubmit).toBe(true)
    expect(docApprovalState({ status_code: 'approved' }, [], 'me').canSubmit).toBe(false)
    // In review already: asking again would start a second workflow for the same document.
    expect(docApprovalState({ status_code: 'in_review' }, [approval()], 'me').canSubmit).toBe(false)
  })

  it('lets only an assignee decide, and only while their request is pending', () => {
    const waiting = [approval({ subject_id: 'owner-1' }), approval({ id: 'a2', subject_id: 'owner-2' })]
    expect(docApprovalState({ status_code: 'in_review' }, waiting, 'owner-2').canDecide).toBe(true)
    expect(docApprovalState({ status_code: 'in_review' }, waiting, 'someone-else').canDecide).toBe(false)
    const settled = [approval({ status: 'approved', subject_id: 'owner-1' })]
    const state = docApprovalState({ status_code: 'approved' }, settled, 'owner-1')
    expect(state.canDecide).toBe(false)
    expect(state.decided).toHaveLength(1)
  })

  it('reports who is still being waited on', () => {
    const state = docApprovalState({ status_code: 'in_review' }, [
      approval({ subject_id: 'owner-1', status: 'approved' }),
      approval({ id: 'a2', subject_id: 'owner-2' }),
    ], 'owner-2')
    expect(state.pending.map((p) => p.subject_id)).toEqual(['owner-2'])
    expect(state.mine?.id).toBe('a2')
  })
})
