import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getIdeaDraftJob, recoverIdeaDraftLiveSummary, type IdeaDraftJobStatusResponse, type IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'
import { recoverBrainstormSummaryOnResume } from '../lib/brainstormLiveSummary'
import { mergeBrainstormUiMessages } from '../lib/brainstormMessageTiming'
import { BrainstormAssistantContent } from './IdeaBacklogManagementPage'
vi.mock('@/modules/core-shell/components/AssistantMermaidBlock', () => ({ AssistantMermaidBlock: () => null }))
vi.mock('@/modules/core-shell/components/AssistantChartBlock', () => ({ AssistantChartBlock: () => null }))
vi.mock('@/lib/api/httpClient', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/httpClient')>(), tectonaServiceHeaders: () => ({ 'X-Test-Identity': 'synthetic' }) }))
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request') }))
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const question = 'Apakah proses Human-in-the-loop terjadi sebelum petugas meninjau tiket?'
const summary = Array.from({ length: 32 }, (_, i) => `${i + 1}. Catatan simulasi yang belum disetujui dan tidak menjadi fakta.`).join('\n')
const message = (overrides: Partial<IdeaDraftBrainstormMessage> = {}): IdeaDraftBrainstormMessage => ({ role: 'assistant', text: summary, summary, question_text: question, question_kind: 'extended', question_focus: 'business', ...overrides })
async function render(value: IdeaDraftBrainstormMessage, onConfirm?: (choice: string) => void) {
  await act(async () => root.render(createElement(BrainstormAssistantContent, { message: value, indonesian: true, onConfirm })))
}
describe('actual brainstorming assistant reply presentation', () => {
  it.each(['mandatory', 'challenge', 'extended'] as const)('shows structured %s question before collapsed recap', async kind => {
    await render(message({ question_kind: kind }))
    const prompt = container.querySelector('[data-brainstorm-question]')!
    const recap = container.querySelector('button[aria-expanded="false"]')!
    expect(prompt.textContent).toBe(question)
    expect(prompt.compareDocumentPosition(recap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.textContent?.split(question)).toHaveLength(2)
  })
  it('keeps technical imperative prompts and trailing instructions without duplication', async () => {
    const imperative = 'Jelaskan integrasi sistem yang dibutuhkan.'
    await render(message({ question_focus: 'technical', question_text: imperative, text: `**${imperative}**\n\nSebutkan keterbatasan, jangan mengarang fakta.` }))
    expect(container.querySelector('[data-brainstorm-question]')?.textContent).toBe(imperative)
    expect(container.textContent?.split(imperative)).toHaveLength(2)
    expect(container.textContent).toContain('Sebutkan keterbatasan, jangan mengarang fakta.')
  })
  it('does not lose a question when the body contains a fenced diagram', async () => {
    await render(message({ text: '```mermaid\nflowchart LR\n A --> B\n```' }))
    expect(container.querySelector('[data-brainstorm-question]')?.textContent).toBe(question)
  })
  it('preserves the question on JSON restore and rerender/retry without duplicating it', async () => {
    const stored = JSON.parse(JSON.stringify(message({ text: `Catatan.\n\n${question}\n\nPilih jawaban sesuai kondisi sebenarnya.` })))
    await render(stored); await render({ ...stored })
    expect(container.textContent?.split(question)).toHaveLength(2)
    expect(container.textContent).toContain('Pilih jawaban sesuai kondisi sebenarnya.')
  })
  it('keeps confirmation question and proposed answer together', async () => {
    await render(message({ question_kind: 'confirm', text: 'Keputusan yang diusulkan.', decision_text: 'Keputusan yang diusulkan.', confirmation_choices: ['Ya', 'Revisi'] }))
    expect(container.textContent).toContain(question)
    expect(container.textContent).toContain('Keputusan yang diusulkan.')
  })
  it('keeps revision proposal, question, explanation and controls in the same confirmation panel', async () => {
    const onConfirm = vi.fn()
    await render(message({ question_kind: 'confirm', question_text: 'Apakah revisi ini sudah sesuai?', text: 'Periksa perubahan ini sebelum menyetujui.', revision_text: 'Petugas meninjau draf, tidak mengirim otomatis.', confirmation_choices: ['Ya', 'Revisi'] }), onConfirm)
    const panel = container.querySelector('[data-brainstorm-confirmation]')!
    expect(panel.querySelector('[data-brainstorm-question]')?.textContent).toBe('Apakah revisi ini sudah sesuai?')
    expect(panel.textContent).toContain('Petugas meninjau draf, tidak mengirim otomatis.')
    expect(panel.textContent).toContain('Periksa perubahan ini sebelum menyetujui.')
    expect(panel.querySelectorAll('button').length).toBeGreaterThan(0)
    expect(onConfirm).not.toHaveBeenCalled()
  })
  it('does not promote suggestion labels into a question or summary', async () => {
    await render(message({ question_text: null, question_kind: null, text: 'Pilih langkah berikutnya.', summary: null, suggestion_options: [{ label: 'Lanjut bisnis', action: 'business', explanation: 'Saran navigasi' }] }))
    expect(container.querySelector('[data-brainstorm-question]')).toBeNull()
    expect(container.textContent).not.toContain('Lanjut bisnis')
  })
  it.runIf(Boolean(process.env.BRAINSTORM_QA_FIXTURE))('renders the exact saved simulation fixture without changing its data', async () => {
    const fixture = JSON.parse(readFileSync(process.env.BRAINSTORM_QA_FIXTURE!, 'utf8'))
    const last = fixture.job.brainstorm_messages.at(-1)
    const before = JSON.stringify(last)
    await render(last)
    expect(container.querySelector('[data-brainstorm-question]')?.textContent).toBe(last.question_text)
    expect(container.textContent?.split(last.question_text)).toHaveLength(2)
    expect(container.querySelector('button[aria-expanded="false"]')).not.toBeNull()
    expect(JSON.stringify(last)).toBe(before)
  })
})


// Minimized public GET shape: structured prompt absent from a truncated recap body.
// Uses fictional content only; the exact signed-owner GET artifact is an optional extra.
const publicResponse = (): IdeaDraftJobStatusResponse => ({
  job_id: 'simulation-public-get', status: 'awaiting_input', progress_percent: 100,
  current_step: null, plan: [], similar_documents: [], similar_ideas: [],
  evidence_summary: { gaps: [] }, warnings: [], correlation_id: 'synthetic',
  brainstorm_messages: [
    { role: 'user', text: 'Lanjut pertanyaan bisnis.' },
    message({ text: `${summary}\n\nDraft Use Case belum tersedia. Sebutkan aktor dan aksi tanpa mengarang fakta.`, conversation_action: 'discovery_question' }),
  ],
  live_summary: { status: 'ready', sections: [], text: 'Ringkasan simulasi.' },
} as IdeaDraftJobStatusResponse)

async function verifyPublicPipeline(payload: IdeaDraftJobStatusResponse, recover = false) {
  const original = JSON.stringify(payload)
  const requests: string[] = []
  const unexpected: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    requests.push(`${init?.method} ${url}`)
    const path = `/v1/agent/idea-draft-jobs/${encodeURIComponent(payload.job_id)}`
    if (init?.method === 'GET' && url.endsWith(path)) return new Response(JSON.stringify(payload), { status: 200 })
    if (recover && init?.method === 'POST' && url.endsWith(`${path}/live-summary/recover`)) {
      return new Response(JSON.stringify({ ...payload, live_summary: { ...payload.live_summary, status: 'ready' } }), { status: 200 })
    }
    unexpected.push(`${init?.method} ${url}`)
    throw new Error(`Unexpected network request: ${init?.method} ${url}`)
  }))
  const loaded = await getIdeaDraftJob(payload.job_id)
  const ready = await recoverBrainstormSummaryOnResume(loaded, recoverIdeaDraftLiveSummary)
  expect(ready.live_summary?.status).toBe('ready')
  const messages = mergeBrainstormUiMessages([], ready.brainstorm_messages)
  const restored = mergeBrainstormUiMessages(messages, (await getIdeaDraftJob(payload.job_id)).brainstorm_messages)
  for (const last of [messages.at(-1)!, restored.at(-1)!]) {
    await render(last)
    const prompt = container.querySelector('[data-brainstorm-question]')!
    const recap = container.querySelector('button[aria-expanded="false"]')!
    expect(prompt.textContent).toBe(last.question_text)
    expect(container.textContent?.split(last.question_text!)).toHaveLength(2)
    expect(prompt.compareDocumentPosition(recap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(last.question_kind).toBe('extended')
    expect(last.question_focus).toBe('business')
    expect(last.conversation_action).toBe('discovery_question')
  }
  expect(requests.filter(request => request.startsWith('GET'))).toHaveLength(2)
  expect(requests.filter(request => request.startsWith('POST'))).toHaveLength(recover ? 1 : 0)
  expect(unexpected).toEqual([])
  expect(JSON.stringify(payload)).toBe(original)
}
describe('public API to resumed assistant component', () => {
  it.each([false, true])('preserves prompt through GET, summary recovery=%s, merge and reload', async recover => {
    const payload = publicResponse()
    if (recover) payload.live_summary!.status = 'unavailable'
    await verifyPublicPipeline(payload, recover)
    expect(container.textContent).toContain('Sebutkan aktor dan aksi tanpa mengarang fakta.')
  })
  it.runIf(Boolean(process.env.BRAINSTORM_PUBLIC_GET_FIXTURE))('renders exact signed-owner serialized GET artifact through the same pipeline', async () => {
    await verifyPublicPipeline(JSON.parse(readFileSync(process.env.BRAINSTORM_PUBLIC_GET_FIXTURE!, 'utf8')))
  })
})
