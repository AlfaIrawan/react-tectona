import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

// Execute only selected production handlers; no page mount, transport or external state.
const source = readFileSync('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(predicate: (node: ts.Node) => boolean): ts.Node {
  let result: ts.Node | undefined
  const visit = (node: ts.Node) => { if (!result && predicate(node)) result = node; if (!result) ts.forEachChild(node, visit) }
  visit(ast)
  if (!result) throw new Error('Production handler not found')
  return result
}
function expression(name: string): string {
  const node = find(node => (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.getText(ast) === name)
  return ts.isVariableDeclaration(node) ? node.initializer!.getText(ast) : node.getText(ast)
}
function bind(code: string, dependencies: Record<string, unknown>) {
  const output = ts.transpileModule(`export default (${code})`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} as { default: (...args: unknown[]) => unknown } }
  new Function(...Object.keys(dependencies), 'module', 'exports', output)(...Object.values(dependencies), module, module.exports)
  return module.exports.default
}
const validate = bind(expression('validateIdeaTitle'), { normalizeIdeaTitle: (title: string) => title.replace(/\s+/gu, ' ').trim() })
const failure = 'IDEA_DRAFT_FIDELITY: UNSUPPORTED_SCOPE_OR_CAUSAL_CLAIM. Previous draft preserved.'
const job = (error = failure) => ({ status: 'awaiting_input', error_message: error, brainstorm_messages: [{ role: 'assistant', text: 'Saved conversation' }], evidence_summary: { gaps: [] }, result: { draft_text: 'Previous draft, not a new success.' } })
function stateHarness() {
  const state = { chat: '', drawer: '' }
  const deps = {
    friendlyBrainstormError: (text: string) => text,
    setBrainstormError: (value: string) => { state.chat = value },
    setAiAssistanceError: (value: string) => { state.drawer = value },
    setIdeaDraftJob: vi.fn(), setBrainstormMessages: vi.fn(), setBrainstormReady: vi.fn(), setBrainstormRemainingGaps: vi.fn(), setBrainstormLatestKind: vi.fn(), setBrainstormOfferGenerateAnyway: vi.fn(), syncBrainstormEvidenceState: vi.fn(),
  }
  return { state, deps, apply: bind(expression('applyIdeaDraftBrainstormState'), deps) }
}
it('polling awaiting_input failure retains feedback and returns old result without applying it', async () => {
  const h = stateHarness(), payload = job(), applyResult = vi.fn()
  const poll = bind(expression('waitForIdeaDraftJob'), { getIdeaDraftJob: vi.fn(async () => payload), setIdeaDraftJob: vi.fn(), applyIdeaDraftBrainstormState: h.apply, setIsEvidenceDialogOpen: vi.fn(), applyCompletedIdeaDraft: applyResult })
  const returned = await poll('synthetic-job')
  expect(returned).toBe(payload)
  expect(h.state).toEqual({ chat: failure, drawer: failure })
  expect(applyResult).not.toHaveBeenCalled()
})
it('resume apply-state restores persisted feedback after local reset', () => {
  const h = stateHarness()
  h.state.chat = ''; h.state.drawer = ''
  h.apply(job())
  expect(h.state).toEqual({ chat: failure, drawer: failure })
})
it('ready payload without error neither fabricates nor silently clears previous feedback', () => {
  const h = stateHarness()
  h.apply(job(''))
  expect(h.state).toEqual({ chat: '', drawer: '' })
  h.apply(job()); h.apply(job(''))
  expect(h.state.chat).toBe(failure)
})
it('ignores stale error fields on running or completed payloads', () => {
  const h = stateHarness()
  h.apply({ ...job(), status: 'running' }); h.apply({ ...job(), status: 'completed' })
  expect(h.state).toEqual({ chat: '', drawer: '' })
})
it('valid assistance retry clears stale title feedback before starting work', async () => {
  let error = 'Please enter an idea title before continuing.'
  const handler = bind(expression('handleAiAssistance'), { createIdeaForm: { title: '[SIMULASI QA] Gen AI Helpdesk', description: '' }, validateIdeaTitle: validate, setCreateIdeaTitleError: (value: string) => { error = value }, setAiAssistanceLoading: () => { throw new Error('STOP_BEFORE_WORK') } })
  await expect(handler('generate_draft')).rejects.toThrow('STOP_BEFORE_WORK')
  expect(error).toBe('')
})
it('submit revalidates valid title before independent description validation', async () => {
  let error = 'stale title error'
  const handler = bind(expression('submitCreateIdea'), { createIdeaDraftValidationError: '', createIdeaForm: { title: 'Valid restored title', description: '' }, validateIdeaTitle: validate, setCreateIdeaTitleError: (value: string) => { error = value }, setCreateIdeaError: vi.fn() })
  await handler()
  expect(error).toBe('')
})
it.each(['Valid saved title', 'Singleword'])('resume revalidates saved title %s', title => {
  const node = find(node => ts.isIfStatement(node) && node.expression.getText(ast) === 'pointerTitle')
  let error = 'stale title error'
  const resume = bind(`() => { ${node.getText(ast)} }`, { pointerTitle: title, validateIdeaTitle: validate, setCreateIdeaTitleError: (value: string) => { error = value }, setCreateIdeaForm: vi.fn(), snapshot: { workspaceId: 'synthetic' }, IDEA_TYPES: ['Innovation'] })
  resume()
  expect(error).toBe(validate(title))
})
it('explicit generation retry clears previous feedback before its request and retains any new failure', async () => {
  const h = stateHarness(); h.apply(job())
  const inFlight = { current: false }
  const stateAtRequest = vi.fn()
  const request = vi.fn(async () => {
    stateAtRequest({ ...h.state }, inFlight.current)
    throw new Error('NEW_FAILURE')
  })
  const handler = bind(expression('handleContinueIdeaDraft'), {
    ...h.deps,
    ideaDraftJob: { job_id: 'synthetic', status: 'awaiting_input' },
    brainstormGenerationDisabled: false,
    continueIdeaDraftInFlightRef: inFlight,
    brainstormAttachmentLifecycle: { state: { preparing: false, attachment: null } },
    brainstormReady: true,
    setIsDraftContinuing: vi.fn(),
    setAiAssistanceLoading: vi.fn(),
    continueIdeaDraftJob: request,
    isIdeaDraftJobLostError: () => false,
    setIsEvidenceDialogOpen: vi.fn(),
  })
  await handler('use_brainstorm')
  expect(request).toHaveBeenCalledOnce()
  expect(stateAtRequest).toHaveBeenCalledWith({ chat: '', drawer: '' }, true)
  expect(h.state).toEqual({ chat: 'NEW_FAILURE', drawer: 'NEW_FAILURE' })
  expect(inFlight.current).toBe(false)
})
it('retains existing successful send/edit boundary that clears chat feedback', () => {
  const send = expression('handleSendBrainstormMessage')
  expect(send).toContain("setBrainstormError('')")
  expect(send.indexOf("setBrainstormError('')")).toBeLessThan(send.indexOf('const sendWithJob'))
})
it.runIf(Boolean(process.env.BRAINSTORM_GENERATION_FAILURE_FIXTURE))('propagates actual recoverable generation fixture error without changing its prior result', () => {
  const payload = JSON.parse(readFileSync(process.env.BRAINSTORM_GENERATION_FAILURE_FIXTURE!, 'utf8')).job
  const before = JSON.stringify(payload)
  const h = stateHarness(); h.apply(payload)
  expect(h.state.chat).toContain('UNSUPPORTED_SCOPE_OR_CAUSAL_CLAIM')
  expect(h.state.drawer).toBe(payload.error_message)
  expect(JSON.stringify(payload)).toBe(before)
})
