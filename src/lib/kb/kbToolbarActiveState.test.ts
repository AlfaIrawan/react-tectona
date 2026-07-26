import { describe, expect, it } from 'vitest'
import { matchKbFontFamilyOption, normalizeKbFontFamilyToken } from './kbRichTextTypography'
import { KB_TOOLBAR_ACTIVE_DEFAULT, readKbToolbarActiveState } from './kbToolbarActiveState'

describe('readKbToolbarActiveState', () => {
  it('returns defaults when editor is null', () => {
    expect(readKbToolbarActiveState(null)).toEqual(KB_TOOLBAR_ACTIVE_DEFAULT)
  })

  it('detects bold/underline from ancestor tags at the selection', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<p><strong><u>Katalog</u></strong> plain</p>'
    document.body.appendChild(editor)

    const underline = editor.querySelector('u')
    expect(underline).toBeTruthy()
    const textNode = underline!.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 1)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const state = readKbToolbarActiveState(editor)
    expect(state.bold).toBe(true)
    expect(state.underline).toBe(true)
    expect(state.italic).toBe(false)
    // jsdom may omit default computed font-family; size should still resolve.
    expect(state.fontSizePx).toMatch(/^\d+$/)

    document.body.removeChild(editor)
  })

  it('reads explicit font-family and font-size from the caret element', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<p><span style="font-family: Georgia, serif; font-size: 18px">Title</span></p>'
    document.body.appendChild(editor)

    const span = editor.querySelector('span')!
    const textNode = span.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 1)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    const state = readKbToolbarActiveState(editor)
    expect(normalizeKbFontFamilyToken(state.fontFamily ?? '')).toContain('georgia')
    expect(state.fontSizePx).toBe('18')
    expect(matchKbFontFamilyOption(state.fontFamily ?? '')).toContain('Georgia')

    document.body.removeChild(editor)
  })
})
