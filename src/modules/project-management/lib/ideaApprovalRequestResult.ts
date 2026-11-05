import type { ApprovalEmailDeliveryDto, WorkflowRunDto } from '@/lib/api/workflowAutomationApi'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Read this request's result, not a second fetch that may fail or include an older round. */
export function ideaApprovalRequestDeliveries(run: WorkflowRunDto): ApprovalEmailDeliveryDto[] {
  if (run.status === 'failed' || run.status === 'cancelled') {
    throw new Error(run.error || 'The approval workflow did not complete the request. Check Runs & Validation.')
  }
  const gate = [...run.steps].reverse().find((step) => step.kind === 'approval' && step.node_id === run.current_node_id)
  const email = record(record(gate?.output).email)
  const deliveries = Array.isArray(email.deliveries) ? email.deliveries : []
  const result: ApprovalEmailDeliveryDto[] = deliveries.flatMap((item) => {
    const delivery = record(item)
    return typeof delivery.ok === 'boolean' && typeof delivery.name === 'string' && typeof delivery.email === 'string'
      ? [delivery as ApprovalEmailDeliveryDto] : []
  })
  if (typeof email.error === 'string' && email.error) {
    result.push({ name: 'Approval email', email: '', ok: false, reason: email.error })
  }
  return result
}
