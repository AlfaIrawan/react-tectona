import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BrainstormSummaryBox } from './BrainstormSummaryBox'
import { BrainstormMarkdown } from './BrainstormMarkdown'
import { restoreIdeaDraftBrainstormSession } from '@/lib/api/tectonaAgentRuntimeApi'
vi.mock('@/modules/core-shell/components/AssistantMermaidBlock', () => ({ AssistantMermaidBlock: () => null }))
vi.mock('@/modules/core-shell/components/AssistantChartBlock', () => ({ AssistantChartBlock: () => null }))
vi.mock('@/lib/api/httpClient', async original => ({ ...await original<typeof import('@/lib/api/httpClient')>(), tectonaServiceHeaders: () => ({}) }))
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network') }))
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const text = '## Tujuan\n\nFakta simulasi.\n\n*Perlu konfirmasi.*\n\n## Asumsi\n\n- Asumsi A\n- Asumsi B\n\n*Belum disetujui.*\n\n1. Langkah pertama\n2. Langkah kedua'
it('preserves explicit sections, mixed source lists and adjacent qualifiers without manufactured numbering', async () => {
  await act(async () => root.render(createElement(BrainstormSummaryBox, { text, summaryMode: 'complete_sources', indonesian: true })))
  expect([...container.querySelectorAll('h2')].map(e => e.textContent)).toEqual(['Tujuan', 'Asumsi'])
  expect(container.querySelectorAll('li')).toHaveLength(4)
  expect(container.querySelectorAll('ol')).toHaveLength(1)
  const qualifier = container.querySelector('em')!.parentElement!
  expect(qualifier.previousElementSibling?.textContent).toBe('Fakta simulasi.')
  expect(container.textContent).not.toContain('catatan')
  expect(container.textContent).not.toContain('Tampilkan')
})
it('keeps legacy unmarked heading behavior and note numbering unchanged', async () => {
  await act(async () => root.render(createElement(BrainstormSummaryBox, { text, indonesian: true })))
  expect(container.querySelector('[data-brainstorm-sectioned-summary]')).toBeNull()
  expect(container.querySelector('h2')).toBeNull()
  expect(container.textContent).toContain('catatan')
})
it('keeps full marked recaps collapsed until requested, then exposes the entire source', async () => {
  const long = text + '\n\n' + 'Informasi belum diketahui. '.repeat(80)
  await act(async () => root.render(createElement(BrainstormSummaryBox, { text: long, summaryMode: 'complete_sources', indonesian: true })))
  expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false')
  expect(container.querySelector('h2')).toBeNull()
  await act(async () => container.querySelector('button')!.click())
  expect(container.textContent?.match(/Informasi belum diketahui\./g)).toHaveLength(80)
  expect(container.querySelectorAll('button')).toHaveLength(1)
})
it('preserves marked summary bytes on restore while retaining the legacy cap', async () => {
  const long = 'Fakta simulasi. '.repeat(1300)
  let body: { messages: Array<{ summary: string; summary_mode?: string }> } | undefined
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toContain('/idea-draft-jobs/restore-brainstorm')
    body = JSON.parse(String(init.body))
    return new Response('{}', { status: 200 })
  }))
  await restoreIdeaDraftBrainstormSession({ title: 'Simulasi', messages: [{ role: 'assistant', text: 'Recap', summary: long, summary_mode: 'complete_sources' }, { role: 'assistant', text: 'Legacy', summary: long }, { role: 'user', text: 'User', summary: long, summary_mode: 'complete_sources' }, JSON.parse(JSON.stringify({ role: 'assistant', text: 'Unknown', summary: long, summary_mode: 'other' }))] })
  expect(body!.messages[0].summary).toBe(long)
  expect(body!.messages[0].summary_mode).toBe('complete_sources')
  for (const legacy of body!.messages.slice(1)) expect(legacy.summary.length).toBeLessThanOrEqual(12000)
})
it.runIf(Boolean(process.env.BRAINSTORM_COMPLETE_SOURCE_FIXTURE))('preserves every rendered source paragraph, heading and qualifier in the actual113 recap', async () => {
  const fixture = JSON.parse(readFileSync(process.env.BRAINSTORM_COMPLETE_SOURCE_FIXTURE!, 'utf8'))
  const message = fixture.job.brainstorm_messages.at(-1)
  expect(message.summary_mode).toBe('complete_sources')
  const source = message.summary
  await act(async () => root.render(createElement(BrainstormMarkdown, { content: source })))
  const expected = container.textContent
  const expectedLists = container.querySelectorAll('ol').length
  await act(async () => root.render(createElement(BrainstormSummaryBox, { text: source, summaryMode: message.summary_mode, indonesian: true })))
  expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false')
  await act(async () => container.querySelector('button')!.click())
  const rendered = container.querySelector('[data-brainstorm-sectioned-summary]')!
  expect(rendered.textContent).toBe(expected)
  expect(rendered.querySelectorAll('h2')).toHaveLength(4)
  expect([...rendered.querySelectorAll('em')].filter(e => e.textContent === 'Perlu konfirmasi.')).toHaveLength(21)
  expect(rendered.querySelectorAll('ol')).toHaveLength(expectedLists)
  expect(container.textContent).not.toContain('57 catatan')
  expect(message.summary).toBe(source)
  let restoredSummary = ''
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toContain('/idea-draft-jobs/restore-brainstorm')
    restoredSummary = JSON.parse(String(init.body)).messages[0].summary
    return new Response('{}', { status: 200 })
  }))
  await restoreIdeaDraftBrainstormSession({ title: 'Simulasi', messages: [message] })
  expect(restoredSummary).toBe(source)
  expect(restoredSummary).toHaveLength(17105)
})
