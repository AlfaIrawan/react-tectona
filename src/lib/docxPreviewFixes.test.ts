import { describe, expect, it } from 'vitest'
import { fixDocxPreviewCellDirection } from './docxPreviewFixes'

function cell(tag: 'td' | 'th', writingMode: string, transform: string): HTMLElement {
  const el = document.createElement(tag)
  el.style.writingMode = writingMode
  el.style.transform = transform
  return el
}

describe('fixDocxPreviewCellDirection', () => {
  it('makes lrTb cells (vertical-lr) horizontal and keeps real vertical text', () => {
    const root = document.createElement('div')
    const lrTb = cell('td', 'vertical-lr', 'none')
    const lrTbHeader = cell('th', 'vertical-lr', 'none')
    const btLr = cell('td', 'vertical-rl', 'rotate(180deg)')
    const tbRl = cell('td', 'vertical-rl', 'none')
    root.append(lrTb, lrTbHeader, btLr, tbRl)

    fixDocxPreviewCellDirection(root)

    expect(lrTb.style.writingMode).toBe('')
    expect(lrTb.style.transform).toBe('')
    expect(lrTbHeader.style.writingMode).toBe('')
    expect(btLr.style.writingMode).toBe('vertical-rl')
    expect(btLr.style.transform).toBe('rotate(180deg)')
    expect(tbRl.style.writingMode).toBe('vertical-rl')
  })
})
