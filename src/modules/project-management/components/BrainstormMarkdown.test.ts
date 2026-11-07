import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrainstormMarkdown, BrainstormQuestion } from './BrainstormMarkdown'
import { normalizeBrainstormDisplayText } from '../lib/brainstormDisplayText'

vi.mock('@/modules/core-shell/components/AssistantMermaidBlock', () => ({ AssistantMermaidBlock: () => null }))
vi.mock('@/modules/core-shell/components/AssistantChartBlock', () => ({ AssistantChartBlock: () => null }))
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
describe('brainstorm text readability', () => {
  it('renders multi-paragraph questions and nested options without raw Markdown', async () => {
    const text = '**Mana yang dipilih?**\n\nPertimbangkan:\n- Opsi A\n  - Asumsi: belum dikonfirmasi\n- Opsi B\n\nApa alasannya?'
    await act(async () => root.render(createElement(BrainstormQuestion, { text })))
    expect(container.querySelectorAll('ul')).toHaveLength(2)
    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(container.querySelectorAll('p')).toHaveLength(3)
    expect(container.querySelector('strong')?.textContent).toBe('Mana yang dipilih?')
    expect(container.textContent).toContain('Asumsi: belum dikonfirmasi')
    expect(container.textContent).not.toContain('**')
  })
  it('renders explicit flattened comparisons without removing qualifiers', async () => {
    const content = 'Perbandingan: - **A:** cepat, belum teruji. - **B:** lebih murah (asumsi). - **C:** perlu validasi.'
    await act(async () => root.render(createElement(BrainstormMarkdown, { content })))
    expect(Array.from(container.querySelectorAll('li')).map(li => li.textContent)).toEqual(['A: cepat, belum teruji.', 'B: lebih murah (asumsi).', 'C: perlu validasi.'])
  })
  it('keeps table semantics, cells and uncertain status', async () => {
    const content = '| Opsi | Status |\n| --- | --- |\n| A | **Fakta:** disetujui |\n| B | Asumsi, belum dikonfirmasi |'
    await act(async () => root.render(createElement(BrainstormMarkdown, { content })))
    expect(container.querySelectorAll('th')).toHaveLength(2)
    expect(container.querySelectorAll('td')).toHaveLength(4)
    expect(container.textContent).toContain('Asumsi, belum dikonfirmasi')
  })
  it('preserves ordinary hyphens, numbered references, code and nested lists', () => {
    const content = 'End-to-end - bukan opsi. Lihat pasal (1) saja.\n\n- induk\n  - anak\n\n```text\n- **A:** satu - **B:** dua\n```\n\n`(1) satu (2) dua`'
    expect(normalizeBrainstormDisplayText(content)).toBe(content)
  })
  it('restores sequential explicit options without deleting conjunctions', () => {
    expect(normalizeBrainstormDisplayText('Pilih (1) A atau (2) B')).toBe('Pilih\n1. A atau\n2. B')
  })
  it('keeps line breaks and unsafe links inert', async () => {
    const content = 'Baris satu\nBaris dua\n\n[buka](javascript:alert(1)) <script>alert(1)</script>'
    await act(async () => root.render(createElement(BrainstormQuestion, { text: content })))
    expect(container.querySelector('p')?.textContent).toBe('Baris satu\nBaris dua')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/^javascript:/)
  })
})
