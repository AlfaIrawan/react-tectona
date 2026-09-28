import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { AssistantChatMarkdown } from './AssistantChatMarkdown'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null

afterEach(() => {
  container?.remove()
  container = null
})

function render(content: string): HTMLDivElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(createElement(AssistantChatMarkdown, { content })))
  return container
}

describe('AssistantChatMarkdown citations', () => {
  it('shows [ref: …] as numbered markers that name the source, never as raw text', () => {
    const el = render([
      '- **Business Value** – Dampak bisnis jelas. [ref: BRD_AdiraFinanceWs_BusinessRequirementDocumentationBRD_V3_20260806]',
      '- **Effort** – Integrasi Ivanti. [ref: BRD_AdiraFinanceWs_BusinessRequirementDocumentationBRD_V3_20260806]',
      '- **ROI** – Belum ada baseline. [ref: URD_V1]',
    ].join('\n'))
    expect(el.textContent).not.toContain('[ref:')
    const marks = [...el.querySelectorAll('sup')].map((s) => [s.textContent, s.getAttribute('title')])
    expect(marks).toEqual([
      ['1', 'Source: BRD_AdiraFinanceWs_BusinessRequirementDocumentationBRD_V3_20260806'],
      ['1', 'Source: BRD_AdiraFinanceWs_BusinessRequirementDocumentationBRD_V3_20260806'],
      ['2', 'Source: URD_V1'],
    ])
    expect(el.querySelector('a')).toBeNull()
  })

  it('keeps ordinary links as links', () => {
    const el = render('Lihat [dokumentasi](https://example.com).')
    expect(el.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expect(el.querySelector('sup')).toBeNull()
  })
})
