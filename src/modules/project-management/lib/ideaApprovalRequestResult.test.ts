import { describe, expect, it } from 'vitest'
import type { WorkflowRunDto } from '@/lib/api/workflowAutomationApi'
import { ideaApprovalRequestDeliveries } from './ideaApprovalRequestResult'

function run(email: unknown): WorkflowRunDto {
  return {
    id: 'run', workflow_id: 'portfolio', status: 'waiting_approval', trigger_type: 'manual',
    current_node_id: 'ap-srd', context: {}, parallel_branches: [],
    steps: [{ id: 'step', run_id: 'run', node_id: 'ap-srd', kind: 'approval', status: 'waiting', output: { email } }],
  }
}

describe('approval request email result', () => {
  it('shows only the current approval round and preserves delivery failures', () => {
    const deliveries = [
      { name: 'Portfolio', email: 'pf@example.test', ok: true },
      { name: 'Analytics', email: 'da@example.test', ok: false, reason: 'SMTP rejected' },
    ]
    const result = run({ deliveries })
    result.steps.unshift({ ...result.steps[0], output: { email: { deliveries: [{ name: 'Old recipient', email: 'old@example.test', ok: true }] } } })
    expect(ideaApprovalRequestDeliveries(result)).toEqual(deliveries)
  })

  it('reports an email service exception instead of success', () => {
    expect(ideaApprovalRequestDeliveries(run({ error: 'Mail service unavailable' }))).toEqual([
      { name: 'Approval email', email: '', ok: false, reason: 'Mail service unavailable' },
    ])
  })

  it('does not call a failed workflow a successful approval request', () => {
    expect(() => ideaApprovalRequestDeliveries({ ...run({}), status: 'failed', error: 'No matching approver' })).toThrow('No matching approver')
  })

  it('does not claim email was sent when there is no outcome', () => {
    expect(ideaApprovalRequestDeliveries(run({}))).toEqual([])
  })
})
