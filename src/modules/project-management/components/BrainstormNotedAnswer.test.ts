import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrainstormNotedAnswer, BrainstormSummaryBox } from './BrainstormSummaryBox'

vi.mock('@/modules/core-shell/components/AssistantMermaidBlock', () => ({ AssistantMermaidBlock: () => null }))
vi.mock('@/modules/core-shell/components/AssistantChartBlock', () => ({ AssistantChartBlock: () => null }))

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(answer: string, tone: 'amber' | 'emerald' = 'amber') {
  await act(async () => root.render(createElement(BrainstormNotedAnswer, { question: 'Pengguna bisnis', answer, tone })))
}

describe('confirmation answer Markdown', () => {
  it('renders screenshot summary topics without inventing a systems heading', async () => {
    const text = '- **Tujuan utama:** memberi jawaban kebijakan cepat\n- **Masalah utama:** pertanyaan lewat WhatsApp tidak compliant\n- **Pengguna bisnis terdampak:** Collector Field; Tim HO Collection'
    await act(async () => root.render(createElement(BrainstormSummaryBox, { text, indonesian: true })))
    expect(container.textContent).toContain('Masalah utama:')
    expect(container.textContent).toContain('Pengguna bisnis terdampak:')
    expect(container.textContent).not.toContain('Sistem dan saluran yang tercatat:')
    expect(container.textContent).not.toContain('**')
    expect(container.querySelectorAll('ol')).toHaveLength(1)
  })

  it.each(['amber', 'emerald'] as const)('renders stored emphasis, not raw delimiters, in %s confirmations', async tone => {
    const answer = 'Pengguna bisnis adalah **Collector Field**, serta **Tim Collection** melalui WhatsApp.'
    await render(answer, tone)
    expect(Array.from(container.querySelectorAll('strong')).map(el => el.textContent)).toEqual(['Collector Field', 'Tim Collection'])
    expect(container.textContent).not.toContain('**')
    expect(answer).toContain('**Collector Field**')
    expect(container.querySelector(`.border-${tone}-400`)).not.toBeNull()
    expect(container.querySelector('p p')).toBeNull()
  })

  it('repairs orphan emphasis while preserving literal code', async () => {
    await render('**Collector Field bertanya. Kode literal: `**contoh**`.')
    expect(container.textContent).toContain('Collector Field bertanya.')
    expect(container.querySelector('code')?.textContent).toBe('**contoh**')
    expect(container.textContent).not.toContain('**Collector Field')
  })

  it('does not execute HTML or permit javascript links from the answer', async () => {
    await render('**Collector Field** <script>alert(1)</script> [buka](javascript:alert(1))')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/^javascript:/)
    expect(container.querySelector('strong')?.textContent).toBe('Collector Field')
  })

  it.each(['amber', 'emerald'] as const)('renders flattened explicit bullets as separate list items in %s panels', async tone => {
    const points = [
      'Collector Field bertanya melalui WhatsApp, berisiko membocorkan data kebijakan.',
      'Collector Field harus membaca Memo Internal atau Ketetapan Sementara secara manual.',
    ]
    const answer = `Masalah utama saat ini adalah: \u2022 ${points[0]} \u2022 ${points[1]}`
    await render(answer, tone)
    expect(container.querySelectorAll('ul')).toHaveLength(1)
    expect(Array.from(container.querySelectorAll('li')).map(li => li.textContent)).toEqual(points)
    expect(container.textContent).toContain('Masalah utama saat ini adalah:')
    expect(container.textContent).not.toContain('\u2022')
    expect(answer).toContain('\u2022')
  })

  it('preserves existing nested lists and literal bullets inside code', async () => {
    await render('- Masalah utama\n  - Pencarian manual\n  - WhatsApp\n\nKode: `a \u2022 b`')
    expect(container.querySelectorAll('ul')).toHaveLength(2)
    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(container.querySelector('code')?.textContent).toBe('a \u2022 b')
  })

  it('does not guess a list from an ordinary sentence containing a bullet glyph', async () => {
    await render('Simbol \u2022 digunakan sebagai pemisah pada dokumen.')
    expect(container.querySelector('ul')).toBeNull()
    expect(container.textContent).toContain('Simbol \u2022 digunakan')
  })
})
