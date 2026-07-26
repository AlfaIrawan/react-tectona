/** Word-like document styles for the KB rich-text editor. */

export type KbDocStyleId =
  | 'normal'
  | 'no-spacing'
  | 'heading'
  | 'heading-2'
  | 'title'
  | 'subtitle'
  | 'subtle-emphasis'
  | 'emphasis'
  | 'intense-emphasis'
  | 'strong'
  | 'quote'
  | 'intense-quote'
  | 'subtle-reference'
  | 'intense-reference'
  | 'book-title'

export type KbDocStyleDef = {
  id: KbDocStyleId
  label: string
  kind: 'block' | 'inline'
  /** Semantic tag for block styles (formatBlock / replace). */
  blockTag?: 'p' | 'h1' | 'h2' | 'h3' | 'blockquote'
  /** Preview classes for the styles gallery chip. */
  previewClassName: string
}

export const KB_DOC_STYLES: KbDocStyleDef[] = [
  { id: 'normal', label: 'Normal', kind: 'block', blockTag: 'p', previewClassName: 'text-[13px] font-normal text-slate-800' },
  { id: 'no-spacing', label: 'No Spacing', kind: 'block', blockTag: 'p', previewClassName: 'text-[13px] font-normal leading-none text-slate-800' },
  { id: 'heading', label: 'Heading', kind: 'block', blockTag: 'h1', previewClassName: 'text-[17px] font-bold text-teal-700' },
  { id: 'heading-2', label: 'Heading 2', kind: 'block', blockTag: 'h2', previewClassName: 'text-[15px] font-bold text-teal-700' },
  { id: 'title', label: 'Title', kind: 'block', blockTag: 'h1', previewClassName: 'text-[22px] font-bold leading-tight text-slate-900' },
  { id: 'subtitle', label: 'Subtitle', kind: 'block', blockTag: 'h2', previewClassName: 'text-[14px] font-normal text-slate-500' },
  { id: 'subtle-emphasis', label: 'Subtle Emphasis', kind: 'inline', previewClassName: 'text-[13px] italic text-slate-400' },
  { id: 'emphasis', label: 'Emphasis', kind: 'inline', previewClassName: 'text-[13px] italic text-slate-800' },
  { id: 'intense-emphasis', label: 'Intense Emphasis', kind: 'inline', previewClassName: 'text-[13px] italic text-teal-700' },
  { id: 'strong', label: 'Strong', kind: 'inline', previewClassName: 'text-[13px] font-bold text-slate-900' },
  { id: 'quote', label: 'Quote', kind: 'block', blockTag: 'blockquote', previewClassName: 'text-[13px] italic text-slate-600' },
  {
    id: 'intense-quote',
    label: 'Intense Quote',
    kind: 'block',
    blockTag: 'blockquote',
    previewClassName: 'border-y border-teal-700/70 py-1 text-[13px] italic text-teal-700',
  },
  { id: 'subtle-reference', label: 'Subtle Reference', kind: 'inline', previewClassName: 'text-[11px] uppercase tracking-wide text-slate-400' },
  { id: 'intense-reference', label: 'Intense Reference', kind: 'inline', previewClassName: 'text-[11px] font-bold uppercase tracking-wide text-teal-700' },
  { id: 'book-title', label: 'Book Title', kind: 'inline', previewClassName: 'text-[13px] font-bold italic text-slate-900' },
]

/** Inline styles baked into HTML so View matches Editor even if CSS/data attrs drift. */
export const KB_DOC_STYLE_INLINE: Record<KbDocStyleId, Partial<CSSStyleDeclaration>> = {
  normal: {
    margin: '0 0 0.5rem',
    fontSize: '14px',
    fontWeight: '400',
    fontStyle: 'normal',
    color: '#0f172a',
    textTransform: 'none',
    letterSpacing: 'normal',
  },
  'no-spacing': {
    margin: '0',
    fontSize: '14px',
    fontWeight: '400',
    fontStyle: 'normal',
    color: '#0f172a',
    lineHeight: '1.25',
  },
  heading: {
    margin: '0.75rem 0 0.4rem',
    fontSize: '24px',
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#0f766e',
    lineHeight: '1.25',
  },
  'heading-2': {
    margin: '0.65rem 0 0.35rem',
    fontSize: '19px',
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#0f766e',
    lineHeight: '1.3',
  },
  title: {
    margin: '0.5rem 0 0.75rem',
    fontSize: '32px',
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#0f172a',
    lineHeight: '1.15',
  },
  subtitle: {
    margin: '0.25rem 0 0.75rem',
    fontSize: '16px',
    fontWeight: '400',
    fontStyle: 'normal',
    color: '#64748b',
  },
  'subtle-emphasis': { fontStyle: 'italic', fontWeight: '400', color: '#94a3b8' },
  emphasis: { fontStyle: 'italic', fontWeight: '400', color: '#0f172a' },
  'intense-emphasis': { fontStyle: 'italic', fontWeight: '400', color: '#0f766e' },
  strong: { fontStyle: 'normal', fontWeight: '700', color: '#0f172a' },
  quote: { margin: '0.75rem 0', fontStyle: 'italic', fontWeight: '400', color: '#475569' },
  'intense-quote': {
    margin: '0.85rem 0',
    padding: '0.5rem 0',
    fontStyle: 'italic',
    fontWeight: '400',
    color: '#0f766e',
    borderTop: '1px solid #0f766e',
    borderBottom: '1px solid #0f766e',
  },
  'subtle-reference': {
    fontSize: '12px',
    fontWeight: '400',
    fontStyle: 'normal',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  'intense-reference': {
    fontSize: '12px',
    fontWeight: '700',
    fontStyle: 'normal',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#0f766e',
  },
  'book-title': { fontWeight: '700', fontStyle: 'italic', color: '#0f172a' },
}

const BLOCK_SELECTOR = 'p,h1,h2,h3,blockquote,div,li'

function closestBlock(node: Node | null, editor: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null =
    node?.nodeType === Node.TEXT_NODE
      ? (node.parentElement as HTMLElement | null)
      : (node as HTMLElement | null)
  while (el && el !== editor) {
    if (el.matches(BLOCK_SELECTOR)) return el
    el = el.parentElement
  }
  return null
}

function replaceBlockTag(source: HTMLElement, targetTag: string): HTMLElement {
  if (source.tagName.toLowerCase() === targetTag.toLowerCase()) return source
  const replacement = document.createElement(targetTag)
  replacement.innerHTML = source.innerHTML || '<br>'
  // Copy non-style attrs we care about later via stamp.
  source.replaceWith(replacement)
  return replacement
}

function cssPropFromCamel(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

/**
 * @param mode `replace` — apply full style template (Styles gallery).
 *   `fill` — only set missing props so View/save keep user font/color overrides from Edit.
 */
function applyInlineDocStyle(
  el: HTMLElement,
  styleId: KbDocStyleId,
  mode: 'replace' | 'fill' = 'replace',
): void {
  const inline = KB_DOC_STYLE_INLINE[styleId]
  if (!inline) return
  for (const [key, value] of Object.entries(inline)) {
    if (value == null || value === '') continue
    const cssProp = cssPropFromCamel(key)
    if (mode === 'fill') {
      const existing = el.style.getPropertyValue(cssProp).trim()
      if (existing) continue
    }
    el.style.setProperty(cssProp, String(value))
  }
}

function stampStyle(el: HTMLElement, styleId: KbDocStyleId): void {
  el.setAttribute('data-kb-style', styleId)
  applyInlineDocStyle(el, styleId, 'replace')
}

function wrapSelectionWithStyle(styleId: KbDocStyleId): boolean {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false
  const range = selection.getRangeAt(0)
  try {
    const span = document.createElement('span')
    stampStyle(span, styleId)
    range.surroundContents(span)
    selection.removeAllRanges()
    const next = document.createRange()
    next.selectNodeContents(span)
    selection.addRange(next)
    return true
  } catch {
    const text = selection.toString()
    if (!text) return false
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const span = document.createElement('span')
    stampStyle(span, styleId)
    span.innerHTML = escaped
    document.execCommand('insertHTML', false, span.outerHTML)
    return true
  }
}

/**
 * Ensure [data-kb-style] elements carry matching inline styles for View ↔ Editor parity.
 * Only fills missing declarations — never overwrites Edit-time font/size/color overrides.
 */
export function hydrateKbDocStyleInlineStyles(content: string): string {
  if (!content || typeof document === 'undefined') return content
  if (!content.includes('data-kb-style')) return content

  const root = document.createElement('div')
  root.innerHTML = content
  let changed = false

  root.querySelectorAll('[data-kb-style]').forEach((node) => {
    const el = node as HTMLElement
    const styleId = el.getAttribute('data-kb-style') as KbDocStyleId | null
    if (!styleId || !KB_DOC_STYLE_INLINE[styleId]) return
    const before = el.getAttribute('style') ?? ''
    applyInlineDocStyle(el, styleId, 'fill')
    const after = el.getAttribute('style') ?? ''
    if (before !== after) changed = true
  })

  return changed ? root.innerHTML : content
}

export function selectionIsInsideKbTable(editor: HTMLElement): boolean {
  const selection = window.getSelection()
  const node = selection?.anchorNode ?? null
  const el =
    node?.nodeType === Node.TEXT_NODE
      ? (node.parentElement as HTMLElement | null)
      : (node as HTMLElement | null)
  return Boolean(el && editor.contains(el) && el.closest('table'))
}

export function readActiveKbDocStyleId(editor: HTMLElement): KbDocStyleId | null {
  const selection = window.getSelection()
  const node = selection?.anchorNode ?? null
  const el =
    node?.nodeType === Node.TEXT_NODE
      ? (node.parentElement as HTMLElement | null)
      : (node as HTMLElement | null)
  if (!el || !editor.contains(el)) return null
  const styled = el.closest('[data-kb-style]') as HTMLElement | null
  if (styled && editor.contains(styled)) {
    const id = styled.getAttribute('data-kb-style') as KbDocStyleId | null
    if (id && KB_DOC_STYLES.some((s) => s.id === id)) return id
  }
  return null
}

export function applyKbDocStyle(editor: HTMLElement, style: KbDocStyleDef): void {
  editor.focus()

  if (style.kind === 'inline') {
    wrapSelectionWithStyle(style.id)
    return
  }

  const tag = style.blockTag ?? 'p'
  const formatValue = tag === 'p' ? 'P' : `<${tag.toUpperCase()}>`
  document.execCommand('formatBlock', false, formatValue)

  const selection = window.getSelection()
  let block = closestBlock(selection?.anchorNode ?? null, editor)

  if (!block || !editor.contains(block)) {
    // Fallback: wrap plain editor content.
    const text = (editor.textContent ?? '').trim()
    if (!text) {
      const empty = document.createElement(tag)
      empty.innerHTML = '<br>'
      stampStyle(empty, style.id)
      editor.innerHTML = ''
      editor.appendChild(empty)
      return
    }
  }

  if (block && editor.contains(block)) {
    if (block.tagName === 'LI') {
      // Apply style on the list item itself for visibility.
      stampStyle(block, style.id)
      return
    }
    block = replaceBlockTag(block, tag)
    stampStyle(block, style.id)

    const nextSelection = window.getSelection()
    if (nextSelection) {
      const range = document.createRange()
      range.selectNodeContents(block)
      range.collapse(false)
      nextSelection.removeAllRanges()
      nextSelection.addRange(range)
    }
  }
}

export function getKbDocStyleById(id: string): KbDocStyleDef | undefined {
  return KB_DOC_STYLES.find((style) => style.id === id)
}
