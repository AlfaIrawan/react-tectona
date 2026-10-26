import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IdeaWorkflowRunDto, WorkflowApprovalDto } from '@/lib/api/workflowAutomationApi'
import { eligibleIdeaApprovals, loadIdeaDecisionGates } from './ideaWorkflowDecisions'
import { listIdeaWorkflowRuns, listWorkflowApprovals } from '@/lib/api/workflowAutomationApi'

vi.mock('@/lib/api/workflowAutomationApi', () => ({ listIdeaWorkflowRuns: vi.fn(), listWorkflowApprovals: vi.fn() }))

const run: IdeaWorkflowRunDto = { id: 'run', workflow_id: 'flow', status: 'waiting_approval', current_node_id: 'gate', approval_request_pending: false, approver_labels: [] }
const approval: WorkflowApprovalDto = {
  id: 'approval', run_id: 'run', workflow_id: 'flow', node_id: 'gate', attempt: 1, subject_id: 'reviewer',
  quorum: 'all', status: 'pending', subject_context: { idea_id: 'idea' },
}

describe('idea workflow decisions', () => {
  beforeEach(() => vi.resetAllMocks())
  it('allows only the assigned pending idea approval at the active node', () => {
    expect(eligibleIdeaApprovals('idea', 'reviewer', [run], [approval])).toEqual([approval])
  })
  it.each([
    { subject_id: 'someone-else' }, { status: 'approved' }, { status: 'cancelled' },
    { node_id: 'old-node' }, { run_id: 'missing' },
    { subject_context: { idea_id: 'other' } },
    { subject_context: { idea_id: 'idea', document_id: 'doc' } },
    { subject_context: { idea_id: 'idea', section_key: 'summary' } },
  ])('does not expose a decision for an unrelated or settled approval: %j', (changes) => {
    expect(eligibleIdeaApprovals('idea', 'reviewer', [run], [{ ...approval, ...changes } as WorkflowApprovalDto])).toEqual([])
  })
  it.each(['running', 'completed', 'failed', 'cancelled'])('refuses a %s run', (status) => {
    expect(eligibleIdeaApprovals('idea', 'reviewer', [{ ...run, status }], [approval])).toEqual([])
  })
  it('never grants a decision to an unauthenticated user', () => {
    expect(eligibleIdeaApprovals('idea', '', [run], [approval])).toEqual([])
  })
  it('loads scoped approvals and filters by the caller even if the API returns other users', async () => {
    vi.mocked(listIdeaWorkflowRuns).mockResolvedValue([run])
    vi.mocked(listWorkflowApprovals).mockResolvedValue([approval, { ...approval, id: 'other', subject_id: 'someone' }])
    expect(await loadIdeaDecisionGates('idea', 'reviewer')).toEqual([approval])
    expect(listWorkflowApprovals).toHaveBeenCalledWith({ subjectContextKey: 'idea_id', subjectContextValue: 'idea', limit: 200 })
  })
  it('propagates availability failures rather than granting a fallback decision', async () => {
    vi.mocked(listIdeaWorkflowRuns).mockRejectedValue(new Error('offline'))
    await expect(loadIdeaDecisionGates('idea', 'reviewer')).rejects.toThrow('offline')
    expect(listWorkflowApprovals).not.toHaveBeenCalled()
  })
})
