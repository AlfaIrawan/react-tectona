import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IdeaWorkflowDecisionDialog } from './IdeaWorkflowDecisionDialog'
import { loadIdeaDecisionGates } from '../lib/ideaWorkflowDecisions'
import { approveWorkflowRun, rejectWorkflowRun, type WorkflowApprovalDto } from '@/lib/api/workflowAutomationApi'

vi.mock('../lib/ideaWorkflowDecisions', () => ({ loadIdeaDecisionGates: vi.fn() }))
vi.mock('@/lib/api/workflowAutomationApi', () => ({ approveWorkflowRun: vi.fn(), rejectWorkflowRun: vi.fn() }))

const gate: WorkflowApprovalDto = {
  id: 'approval', run_id: 'run', workflow_id: 'flow', node_id: 'gate', attempt: 1,
  subject_id: 'reviewer', quorum: 'all', status: 'pending', subject_context: { gate_label: 'Business review' },
}
let root: Root
let host: HTMLDivElement
const saved = vi.fn()
const closed = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  vi.mocked(loadIdeaDecisionGates).mockResolvedValue([gate])
  vi.mocked(rejectWorkflowRun).mockResolvedValue({} as never)
  vi.mocked(approveWorkflowRun).mockResolvedValue({} as never)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

async function render(mode: 'approve' | 'reject' | 'revision' = 'reject') {
  await act(async () => root.render(createElement(IdeaWorkflowDecisionDialog, {
    idea: { id: 'idea', title: 'Example idea' }, mode, userId: 'reviewer', onClose: closed, onSaved: saved,
  })))
}
function command(label: string) {
  return [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)!
}
async function reason(text: string) {
  await act(async () => {
    const textarea = document.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('requires a reason and sends exactly the workflow rejection, never a status PATCH', async () => {
  await render()
  expect(command('Reject').disabled).toBe(true)
  await reason('   ')
  expect(command('Reject').disabled).toBe(true)
  await reason('  Duplicate business need  ')
  await act(async () => command('Reject').click())
  expect(rejectWorkflowRun).toHaveBeenCalledWith('run', 'Duplicate business need', 'reject', 'approval')
  expect(saved).toHaveBeenCalledTimes(1)
})

it('keeps a failed decision open and never announces success', async () => {
  vi.mocked(rejectWorkflowRun).mockRejectedValue(new Error('Server refused the decision'))
  await render()
  await reason('Insufficient evidence')
  await act(async () => command('Reject').click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Server refused')
  expect(saved).not.toHaveBeenCalled()
  expect(closed).not.toHaveBeenCalled()
})

it('rechecks an expired assignment before sending', async () => {
  await render()
  vi.mocked(loadIdeaDecisionGates).mockResolvedValue([])
  await reason('Insufficient evidence')
  await act(async () => command('Reject').click())
  expect(rejectWorkflowRun).not.toHaveBeenCalled()
  expect(saved).not.toHaveBeenCalled()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('no longer assigned')
})

it('fails closed when approval lookup is unavailable', async () => {
  vi.mocked(loadIdeaDecisionGates).mockRejectedValue(new Error('Workflow unavailable'))
  await render()
  expect(command('Reject').disabled).toBe(true)
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Workflow unavailable')
})

it('allows an approval without a comment and sends revision separately', async () => {
  await render('approve')
  await act(async () => command('Approve').click())
  expect(approveWorkflowRun).toHaveBeenCalledWith('run', undefined, 'approval')
  expect(rejectWorkflowRun).not.toHaveBeenCalled()
})

it('sends request revision with its mandatory reason', async () => {
  await render('revision')
  await reason('Please clarify benefits')
  await act(async () => command('Request Revision').click())
  expect(rejectWorkflowRun).toHaveBeenCalledWith('run', 'Please clarify benefits', 'revision', 'approval')
})

it('does not choose arbitrarily when multiple approvals exist', async () => {
  vi.mocked(loadIdeaDecisionGates).mockResolvedValue([gate, { ...gate, id: 'another', run_id: 'another-run' }])
  await render()
  await reason('Insufficient evidence')
  expect(command('Reject').disabled).toBe(true)
  expect(document.querySelector('select')?.value).toBe('')
})
