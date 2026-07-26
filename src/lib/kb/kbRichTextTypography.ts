/** Typography helpers for KB contentEditable toolbar (font family/size + change case). */

export const KB_FONT_FAMILY_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Aptos (Body)', value: 'Aptos, Calibri, Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
]

export const KB_FONT_SIZE_OPTIONS = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36'] as const

export type KbTextCaseMode = 'sentence' | 'lower' | 'upper' | 'title' | 'toggle'

export const KB_TEXT_CASE_OPTIONS: Array<{ label: string; value: KbTextCaseMode }> = [
  { label: 'Sentence case.', value: 'sentence' },
  { label: 'lowercase', value: 'lower' },
  { label: 'UPPERCASE', value: 'upper' },
  { label: 'Capitalize Each Word', value: 'title' },
  { label: 'tOGGLE cASE', value: 'toggle' },
]

const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 72

export function clampKbFontSizePx(size: number): number {
  if (!Number.isFinite(size)) return 12
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(size)))
}

/** First family token from a CSS font-family stack, lowercased, quotes stripped. */
export function normalizeKbFontFamilyToken(value: string): string {
  return (value.split(',')[0] ?? '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .toLowerCase()
}

/** Map a computed font-family to the closest toolbar option value. */
export function matchKbFontFamilyOption(computedFamily: string): string {
  const primary = normalizeKbFontFamilyToken(computedFamily)
  if (!primary) return KB_FONT_FAMILY_OPTIONS[0]?.value ?? 'Arial, Helvetica, sans-serif'

  const exact = KB_FONT_FAMILY_OPTIONS.find((option) => normalizeKbFontFamilyToken(option.value) === primary)
  if (exact) return exact.value

  const partial = KB_FONT_FAMILY_OPTIONS.find((option) => {
    const token = normalizeKbFontFamilyToken(option.value)
    return primary.includes(token) || token.includes(primary)
  })
  return partial?.value ?? KB_FONT_FAMILY_OPTIONS[0]?.value ?? 'Arial, Helvetica, sans-serif'
}

export function transformKbTextCase(text: string, mode: KbTextCaseMode): string {
  switch (mode) {
    case 'lower':
      return text.toLocaleLowerCase()
    case 'upper':
      return text.toLocaleUpperCase()
    case 'title':
      return text.toLocaleLowerCase().replace(/\b([\p{L}\p{N}])/gu, (ch) => ch.toLocaleUpperCase())
    case 'toggle':
      return Array.from(text)
        .map((ch) => {
          const upper = ch.toLocaleUpperCase()
          const lower = ch.toLocaleLowerCase()
          if (ch === upper && ch !== lower) return lower
          if (ch === lower && ch !== upper) return upper
          return ch
        })
        .join('')
    case 'sentence': {
      const lower = text.toLocaleLowerCase()
      return lower.replace(/(^\s*|[.!?]\s+)([\p{L}])/gu, (_m, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`)
    }
    default:
      return text
  }
}

export function readSelectionFontSizePx(editor: HTMLElement, fallback = 12): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return fallback
  const node = selection.anchorNode
  const el =
    node?.nodeType === Node.TEXT_NODE
      ? (node.parentElement as HTMLElement | null)
      : (node as HTMLElement | null)
  if (!el || !editor.contains(el)) return fallback
  const parsed = Number.parseFloat(window.getComputedStyle(el).fontSize)
  return clampKbFontSizePx(Number.isFinite(parsed) ? parsed : fallback)
}

/** Apply font-size via legacy fontSize=7 then rewrite to concrete px (selection-scoped). */
export function applyKbSelectionFontSizePx(editor: HTMLElement, sizePx: number): void {
  const px = clampKbFontSizePx(sizePx)
  editor.focus()
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand('fontSize', false, '7')

  editor.querySelectorAll('[style*="xxx-large" i], [style*="xx-large" i]').forEach((node) => {
    const el = node as HTMLElement
    el.style.fontSize = `${px}px`
  })

  editor.querySelectorAll('font[size="7"]').forEach((node) => {
    const fontEl = node as HTMLFontElement
    const span = document.createElement('span')
    span.style.fontSize = `${px}px`
    const face = fontEl.getAttribute('face')
    if (face) span.style.fontFamily = face
    while (fontEl.firstChild) span.appendChild(fontEl.firstChild)
    fontEl.replaceWith(span)
  })
}

export function applyKbSelectionFontFamily(editor: HTMLElement, family: string): void {
  editor.focus()
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand('fontName', false, family)
}

export function applyKbSelectionTextCase(editor: HTMLElement, mode: KbTextCaseMode): boolean {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false
  if (!editor.contains(selection.anchorNode)) return false
  const original = selection.toString()
  if (!original) return false
  editor.focus()
  document.execCommand('insertText', false, transformKbTextCase(original, mode))
  return true
}
