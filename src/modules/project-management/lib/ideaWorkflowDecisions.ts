import {
  listIdeaWorkflowRuns,
  listWorkflowApprovals,
  type IdeaWorkflowRunDto,
  type WorkflowApprovalDto,
} from '@/lib/api/workflowAutomationApi'

export type IdeaDecisionMode = 'approve' | 'reject' | 'revision'

export function eligibleIdeaApprovals(
  ideaId: string,
  userId: string,
  runs: IdeaWorkflowRunDto[],
  approvals: WorkflowApprovalDto[],
): WorkflowApprovalDto[] {
  return approvals.filter((approval) => {
    const run = runs.find((item) => item.id === approval.run_id)
    return Boolean(userId)
      && approval.subject_id === userId
      && approval.status === 'pending'
      && approval.subject_context.idea_id === ideaId
      && !approval.subject_context.document_id
      && !approval.subject_context.section_key
      && run?.status === 'waiting_approval'
      && run.current_node_id === approval.node_id
  })
}

export async function loadIdeaDecisionGates(ideaId: string, userId: string) {
  const runs = await listIdeaWorkflowRuns(ideaId)
  const approvals = await listWorkflowApprovals({
    subjectContextKey: 'idea_id', subjectContextValue: ideaId, limit: 200,
  })
  return eligibleIdeaApprovals(ideaId, userId, runs, approvals)
}
