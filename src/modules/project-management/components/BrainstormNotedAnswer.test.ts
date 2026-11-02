import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrainstormNotedAnswer } from './BrainstormSummaryBox'

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
})
