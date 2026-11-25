import { readFileSync } from 'node:fs'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BrainstormLiveSummaryPanel } from './BrainstormLiveSummaryPanel'
import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'
vi.mock('@/modules/core-shell/components/AssistantMermaidBlock', () => ({ AssistantMermaidBlock: () => null }))
vi.mock('@/modules/core-shell/components/AssistantChartBlock', () => ({ AssistantChartBlock: () => null }))
let container: HTMLDivElement, root: Root
let reduced = false, mobile = false
let frames: FrameRequestCallback[]
beforeEach(() => {
  reduced = false; mobile = false; frames = []
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion') ? reduced : query.includes('min-width: 1440') ? !mobile : mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
const makeJob = (body = 'Tujuan lengkap, bukan fakta tambahan.') => ({ job_id: 'saved-simulation', status: 'awaiting_input', revision: 'r1', brainstorm_messages: [], live_summary: { status: 'ready', source_revision: 'r1', sections: [{ key: 'objective', title: 'Tujuan', body }] } } as IdeaDraftJobStatusResponse)
async function render(job: IdeaDraftJobStatusResponse | null, mobileExpanded?: boolean, state: { busy?: boolean; requestFailed?: boolean } = {}) {
  await act(async () => root.render(createElement(BrainstormLiveSummaryPanel, { job, busy: false, mobileExpanded, ...state })))
}
function visibleText() {
  const wrapper = container.querySelector('[data-summary-phase]')
  return [...(wrapper?.children ?? [])].filter(node => !node.classList.contains('invisible') && !node.classList.contains('sr-only')).map(node => node.textContent).join('')
}
it('renders readable paragraphs even while entrance callbacks and timers are stalled', async () => {
  await render(makeJob())
  expect(container.querySelector('h3')?.textContent).toBe('Tujuan')
  expect(visibleText()).toContain('Tujuan lengkap, bukan fakta tambahan.')
})
it('keeps paragraphs readable after panel entrance but before the delayed text-ready timer', async () => {
  await render(makeJob())
  await act(async () => { frames.shift()!(0) })
  await act(async () => { frames.shift()!(16) })
  expect(container.querySelector('[data-summary-entered]')?.getAttribute('data-summary-entered')).toBe('true')
  expect(visibleText()).toContain('Tujuan lengkap, bukan fakta tambahan.')
})
it('publishes changed content without waiting for deletion or typing timers', async () => {
  await render(makeJob('Isi awal.'))
  await act(async () => { frames.shift()!(0) })
  await act(async () => { frames.shift()!(16); vi.advanceTimersByTime(240) })
  await render(makeJob('Isi terbaru; perlu konfirmasi.'))
  expect(visibleText()).toBe('Isi terbaru; perlu konfirmasi.')
})
it('keeps reduced-motion content immediately readable', async () => {
  reduced = true
  await render(makeJob())
  expect(visibleText()).toContain('Tujuan lengkap, bukan fakta tambahan.')
})
it('updates hidden mobile content before it is reopened', async () => {
  mobile = true
  await render(makeJob('Sebelum disembunyikan.'), false)
  await render(makeJob('Informasi terbaru saat tersembunyi.'), false)
  await render(makeJob('Informasi terbaru saat tersembunyi.'), true)
  expect(visibleText()).toBe('Informasi terbaru saat tersembunyi.')
  expect(container.querySelector('[aria-label="Live AI Summary"] [hidden]')).toBeNull()
})
it('renders saved content on remount with no animation progress', async () => {
  await render(makeJob())
  await act(async () => root.unmount())
  root = createRoot(container)
  await render(makeJob('Sesi tersimpan dimuat kembali.'))
  expect(visibleText()).toBe('Sesi tersimpan dimuat kembali.')
})

it('seeds persisted ready matching-revision summary when the separate request failed', async () => {
  await render(makeJob('Sumber tersimpan yang valid.'), undefined, { requestFailed: true })
  expect(visibleText()).toBe('Sumber tersimpan yang valid.')
  expect(container.textContent).toContain('The separate request error is shown in the conversation.')
  expect(container.textContent).not.toContain('Update failed.')
})
it('never seeds a busy partial result, but can show validated persisted summary when busy ends in error', async () => {
  await render(makeJob('Sumber tersimpan yang valid.'), undefined, { busy: true, requestFailed: true })
  expect(visibleText()).toBe('')
  await render(makeJob('Sumber tersimpan yang valid.'), undefined, { requestFailed: true })
  expect(visibleText()).toBe('Sumber tersimpan yang valid.')
})
it.each(['mismatch', 'missing', 'unavailable'] as const)('does not seed error remount with %s validation', async kind => {
  const job = makeJob('Tidak boleh ditampilkan.')
  if (kind === 'mismatch') job.live_summary!.source_revision = 'older'
  if (kind === 'missing') delete job.revision
  if (kind === 'unavailable') job.live_summary!.status = 'unavailable'
  await render(job, undefined, { requestFailed: true })
  expect(visibleText()).toBe('')
})
it('does not replace last processed summary with failed update content', async () => {
  await render(makeJob('Ringkasan sebelumnya.'))
  const failed = makeJob('Konten dari pembaruan gagal.')
  failed.live_summary!.status = 'unavailable'
  await render(failed)
  expect(visibleText()).toBe('Ringkasan sebelumnya.')
  expect(container.textContent).toContain('Update failed. Showing the last processed summary.')
})
it('clears prior job content when the new job has only a failed unvalidated summary', async () => {
  await render(makeJob('Rahasia sesi A.'))
  const next = makeJob('Tidak tervalidasi sesi B.')
  next.job_id = 'different-job'; next.live_summary!.source_revision = 'mismatch'
  await render(next, undefined, { requestFailed: true })
  expect(container.textContent).not.toContain('Rahasia sesi A.')
  expect(visibleText()).toBe('')
})
it('can seed only the new job validated summary on a cross-job error resume', async () => {
  await render(makeJob('Sesi A.'))
  const next = makeJob('Ringkasan valid sesi B.'); next.job_id = 'different-job'
  await render(next, undefined, { requestFailed: true })
  expect(visibleText()).toBe('Ringkasan valid sesi B.')
  expect(container.textContent).not.toContain('Sesi A.')
})

it.runIf(Boolean(process.env.BRAINSTORM_ERROR_JOB_FIXTURE))('renders actual persisted postfailure job on error remount', async () => {
  const job = JSON.parse(readFileSync(process.env.BRAINSTORM_ERROR_JOB_FIXTURE!, 'utf8')).job as IdeaDraftJobStatusResponse
  expect(job.live_summary?.status).toBe('ready')
  expect(job.live_summary?.source_revision).toBe(job.revision)
  expect(job.live_summary?.sections).toHaveLength(11)
  await render(job, undefined, { requestFailed: true })
  expect(container.querySelectorAll('[data-summary-section]')).toHaveLength(11)
  const visibleLayers = [...container.querySelectorAll('[data-summary-phase] > div')]
  expect(visibleLayers.every(layer => Boolean(layer.textContent?.trim()) && !layer.classList.contains('invisible'))).toBe(true)
  expect(container.textContent).toContain('The separate request error is shown in the conversation.')
})
