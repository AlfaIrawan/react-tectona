/** Detect active formatting at the current selection for KB toolbar button states. */

import { clampKbFontSizePx } from './kbRichTextTypography'

export type KbToolbarActiveState = {
  bold: boolean
  italic: boolean
  underline: boolean
  justifyLeft: boolean
  justifyCenter: boolean
  justifyRight: boolean
  justifyFull: boolean
  unorderedList: boolean
  orderedList: boolean
  /** Computed font-family at the caret, or null if selection is outside the editor. */
  fontFamily: string | null
  /** Rounded font-size in px at the caret, or null if selection is outside the editor. */
  fontSizePx: string | null
}

export const KB_TOOLBAR_ACTIVE_DEFAULT: KbToolbarActiveState = {
  bold: false,
  italic: false,
  underline: false,
  justifyLeft: false,
  justifyCenter: false,
  justifyRight: false,
  justifyFull: false,
  unorderedList: false,
  orderedList: false,
  fontFamily: null,
  fontSizePx: null,
}

function selectionAnchorElement(editor: HTMLElement): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const node = selection.anchorNode
  if (!node || !editor.contains(node)) return null
  return node.nodeType === Node.TEXT_NODE
    ? (node.parentElement as HTMLElement | null)
    : (node as HTMLElement)
}

function queryState(command: string): boolean {
  try {
    return Boolean(document.queryCommandState(command))
  } catch {
    return false
  }
}

function walkAncestors(start: HTMLElement, editor: HTMLElement, visit: (el: HTMLElement) => boolean): boolean {
  let el: HTMLElement | null = start
  while (el && el !== editor) {
    if (visit(el)) return true
    el = el.parentElement
  }
  return false
}

function isBoldAt(el: HTMLElement, editor: HTMLElement): boolean {
  if (queryState('bold')) return true
  return walkAncestors(el, editor, (node) => {
    if (node.tagName === 'B' || node.tagName === 'STRONG') return true
    const weight = window.getComputedStyle(node).fontWeight
    const numeric = Number(weight)
    return weight === 'bold' || (Number.isFinite(numeric) && numeric >= 600)
  })
}

function isItalicAt(el: HTMLElement, editor: HTMLElement): boolean {
  if (queryState('italic')) return true
  return walkAncestors(el, editor, (node) => {
    if (node.tagName === 'I' || node.tagName === 'EM') return true
    return window.getComputedStyle(node).fontStyle === 'italic'
  })
}

function isUnderlineAt(el: HTMLElement, editor: HTMLElement): boolean {
  if (queryState('underline')) return true
  return walkAncestors(el, editor, (node) => {
    if (node.tagName === 'U') return true
    const deco = window.getComputedStyle(node).textDecorationLine || window.getComputedStyle(node).textDecoration
    return deco.toLowerCase().includes('underline')
  })
}

function alignmentAt(el: HTMLElement, editor: HTMLElement): 'left' | 'center' | 'right' | 'justify' | null {
  if (queryState('justifyCenter')) return 'center'
  if (queryState('justifyRight')) return 'right'
  if (queryState('justifyFull')) return 'justify'
  if (queryState('justifyLeft')) return 'left'

  let block: HTMLElement | null = el
  while (block && block !== editor) {
    if (/^(P|H1|H2|H3|DIV|LI|BLOCKQUOTE|TD|TH)$/.test(block.tagName)) break
    block = block.parentElement
  }
  if (!block || block === editor) return null
  const align = (window.getComputedStyle(block).textAlign || '').toLowerCase()
  if (align === 'center') return 'center'
  if (align === 'right' || align === 'end') return 'right'
  if (align === 'justify') return 'justify'
  if (align === 'left' || align === 'start') return 'left'
  return null
}

function typographyAt(el: HTMLElement): { fontFamily: string; fontSizePx: string } {
  const style = window.getComputedStyle(el)
  const fontFamily = style.fontFamily || ''
  const parsed = Number.parseFloat(style.fontSize || '')
  const fontSizePx = String(clampKbFontSizePx(Number.isFinite(parsed) ? parsed : 12))
  return { fontFamily, fontSizePx }
}

export function readKbToolbarActiveState(editor: HTMLElement | null): KbToolbarActiveState {
  if (!editor) return { ...KB_TOOLBAR_ACTIVE_DEFAULT }
  const el = selectionAnchorElement(editor)
  if (!el) return { ...KB_TOOLBAR_ACTIVE_DEFAULT }

  const align = alignmentAt(el, editor)
  const typography = typographyAt(el)

  return {
    bold: isBoldAt(el, editor),
    italic: isItalicAt(el, editor),
    underline: isUnderlineAt(el, editor),
    justifyLeft: align === 'left',
    justifyCenter: align === 'center',
    justifyRight: align === 'right',
    justifyFull: align === 'justify',
    unorderedList: queryState('insertUnorderedList')
      || walkAncestors(el, editor, (node) => node.tagName === 'UL'),
    orderedList: queryState('insertOrderedList')
      || walkAncestors(el, editor, (node) => node.tagName === 'OL'),
    fontFamily: typography.fontFamily || null,
    fontSizePx: typography.fontSizePx,
  }
}
