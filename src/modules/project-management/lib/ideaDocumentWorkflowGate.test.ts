import { describe, expect, it } from 'vitest'
import type { WorkflowApprovalDto, WorkflowGraph } from '@/lib/api/workflowAutomationApi'
import {
  allowedDocumentKinds,
  documentKindsAllowedByWorkflows,
  documentStagesFromGraph,
  templateAllowedByWorkflow,
  templateDocumentKind,
} from '@/modules/project-management/lib/ideaDocumentWorkflowGate'

function node(id: string, kind: string, config: Record<string, string> = {}) {
  return { id, data: { kind, label: id, config } }
}

function edge(source: string, target: string, sourceHandle: string) {
  return { source, target, sourceHandle }
}

const approvalWorkflow: WorkflowGraph = {
  nodes: [
    node('trig', 'trigger'),
    node('par1', 'parallel'),
    node('ap-sum', 'approval'),
    node('ap-arch', 'approval'),
    node('ap-bpmn', 'approval'),
    node('gen-urd', 'action', { actionOperation: 'Upload', parameter: 'URD' }),
    node('ap-urd', 'approval'),
    node('gen-brd', 'action', { actionOperation: 'Upload', parameter: 'BRD' }),
    node('ap-brd', 'approval'),
    node('par2', 'parallel'),
    node('notify', 'action', { actionOperation: 'Send', parameter: 'Email' }),
    node('gen-fsd', 'action', { actionOperation: 'Upload', parameter: 'FSD' }),
    node('end-ok', 'end'),
  ],
  edges: [
    edge('trig', 'par1', 'out'),
    edge('par1', 'ap-sum', 'branchA'),
    edge('par1', 'ap-arch', 'branchB'),
    edge('par1', 'ap-bpmn', 'branchC'),
    edge('par1', 'gen-urd', 'branchD'),
    edge('ap-sum', 'gen-brd', 'true'),
    edge('ap-arch', 'gen-brd', 'true'),
    edge('ap-bpmn', 'gen-brd', 'true'),
    edge('gen-urd', 'ap-urd', 'out'),
    edge('ap-urd', 'gen-brd', 'true'),
    edge('gen-brd', 'ap-brd', 'out'),
    edge('ap-brd', 'par2', 'true'),
    edge('par2', 'notify', 'branchA'),
    edge('par2', 'gen-fsd', 'branchB'),
    edge('notify', 'end-ok', 'out'),
    edge('gen-fsd', 'end-ok', 'out'),
    edge('ap-sum', 'end-sum', 'false'),
  ],
}

function approval(nodeId: string, status: WorkflowApprovalDto['status'], runId = 'run-1'): WorkflowApprovalDto {
  return {
    id: `${runId}-${nodeId}-${status}`,
    run_id: runId,
    workflow_id: 'wf-1',
    node_id: nodeId,
    attempt: 1,
    subject_id: 'user',
    quorum: 'any',
    status,
    subject_context: {},
    requested_at: '2026-10-05T02:00:00Z',
  }
}

describe('idea document workflow gate', () => {
  it('unlocks URD first, then BRD, then FSD', () => {
    const stages = documentStagesFromGraph(approvalWorkflow)
    expect(stages.map((stage) => stage.kind)).toEqual(['URD', 'BRD', 'FSD'])
    expect(stages[0].requiredApprovalIds).toEqual([])
    expect(stages[1].requiredApprovalIds.sort()).toEqual(['ap-arch', 'ap-bpmn', 'ap-sum', 'ap-urd'])
    expect(stages[2].requiredApprovalIds.sort()).toEqual(['ap-arch', 'ap-bpmn', 'ap-brd', 'ap-sum', 'ap-urd'])
  })

  it('ignores a document workflow that has not opened a gate for this idea', () => {
    const stages = documentStagesFromGraph(approvalWorkflow)
    expect(allowedDocumentKinds(stages, [], 'wf-other')).toBeNull()
    expect(allowedDocumentKinds(stages, [approval('ap-sum', 'pending')], 'wf-other')).toBeNull()
  })

  it('blocks later documents while the first approvals are still open', () => {
    const stages = documentStagesFromGraph(approvalWorkflow)
    const open = [
      approval('ap-sum', 'pending'),
      approval('ap-arch', 'pending'),
      approval('ap-bpmn', 'pending'),
      approval('ap-urd', 'pending'),
    ]
    expect(allowedDocumentKinds(stages, open, 'wf-1')).toEqual(['URD'])
  })

  it('allows BRD only after every earlier gate is approved, and FSD after BRD', () => {
    const stages = documentStagesFromGraph(approvalWorkflow)
    const beforeBrd = ['ap-sum', 'ap-arch', 'ap-bpmn', 'ap-urd'].map((id) => approval(id, 'approved'))
    expect(allowedDocumentKinds(stages, beforeBrd, 'wf-1')).toEqual(['URD', 'BRD'])
    const afterBrd = [...beforeBrd, approval('ap-brd', 'approved')]
    expect(allowedDocumentKinds(stages, afterBrd, 'wf-1')).toEqual(['URD', 'BRD', 'FSD'])
  })

  it('does not treat an SRD template code that starts with brd- as a BRD', () => {
    expect(templateDocumentKind({
      name: 'SRD_AdiraFinanceWs_SrdSimplifiedRequirement_V1_20260928',
      template_code: 'brd-adirafinancews-srdsimplifiedrequirement-v1',
    })).toBe('SRD')
    expect(templateAllowedByWorkflow(
      { name: 'BRD_AdiraFinanceWs_BusinessRequirementDocumentationBRD_V3_20260806', template_code: 'brd-example' },
      { enforced: true, allowedKinds: ['URD'] },
    )).toBe(false)
    expect(templateAllowedByWorkflow(
      { name: 'URD_AdiraFinanceWs_Requirement_V1_20260806', template_code: 'urd-example' },
      { enforced: true, allowedKinds: ['URD'] },
    )).toBe(true)
    expect(templateAllowedByWorkflow(
      { name: 'SRD_AdiraFinanceWs_SrdSimplifiedRequirement_V1_20260928', template_code: 'brd-example' },
      { enforced: false, allowedKinds: null },
    )).toBe(true)
  })
})
