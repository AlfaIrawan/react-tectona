/** Keep only safe KB inline styles; strip Tailwind/CSS-variable bloat. */

const TABLE_LAYOUT_STYLE_PROPS = new Set(['width', 'height', 'min-width', 'table-layout'])
const TEXT_ALIGN_STYLE_PROPS = new Set(['text-align'])
const INDENT_STYLE_PROPS = new Set(['margin-left', 'padding-left'])
const TYPOGRAPHY_STYLE_PROPS = new Set([
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
  'color',
  'background-color',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'padding',
  'padding-top',
  'padding-bottom',
  'border-top',
  'border-bottom',
])

const TABLE_STYLE_TAGS = new Set(['TABLE', 'COL', 'COLGROUP', 'TR', 'TD', 'TH'])
const TEXT_ALIGN_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'DIV', 'TD', 'TH', 'SPAN'])
const INDENT_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'DIV', 'UL', 'OL'])
const TYPOGRAPHY_TAGS = new Set(['SPAN', 'P', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'DIV', 'TD', 'TH', 'A'])

const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify', 'start', 'end'])
const TEXT_TRANSFORM_VALUES = new Set(['none', 'uppercase', 'lowercase', 'capitalize'])

function isAllowedTableLayoutValue(prop: string, value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('url(') || trimmed.includes('expression')) return false
  if (prop === 'table-layout') return trimmed === 'fixed' || trimmed === 'auto'
  return /^\d+(\.\d+)?(px)?$/i.test(trimmed)
}

function isAllowedTextAlignValue(value: string): boolean {
  return TEXT_ALIGN_VALUES.has(value.trim().toLowerCase())
}

/** contentEditable indent often sets margin-left: 40px (or em/rem). Cap abuse. */
function isAllowedIndentValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  const match = trimmed.match(/^(\d+(\.\d+)?)(px|em|rem)$/)
  if (!match) return false
  const amount = Number(match[1])
  const unit = match[3]
  if (!Number.isFinite(amount) || amount < 0) return false
  if (unit === 'px') return amount <= 400
  return amount <= 20
}

function isAllowedFontFamilyValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 120) return false
  const lower = trimmed.toLowerCase()
  if (lower.includes('url(') || lower.includes('expression') || lower.includes('javascript')) return false
  // Allow common CSS font stacks: names, quotes, commas, spaces, hyphens.
  return /^[a-z0-9\s,'"_-]+$/i.test(trimmed)
}

function isAllowedFontSizeValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  const match = trimmed.match(/^(\d+(\.\d+)?)(px|pt|em|rem)$/)
  if (!match) return false
  const amount = Number(match[1])
  const unit = match[3]
  if (!Number.isFinite(amount) || amount <= 0) return false
  if (unit === 'px' || unit === 'pt') return amount <= 72
  return amount <= 6
}

function isAllowedTextTransformValue(value: string): boolean {
  return TEXT_TRANSFORM_VALUES.has(value.trim().toLowerCase())
}

function isAllowedFontWeightValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'normal' || trimmed === 'bold') return true
  return /^(100|200|300|400|500|600|700|800|900)$/.test(trimmed)
}

function isAllowedFontStyleValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  return trimmed === 'normal' || trimmed === 'italic' || trimmed === 'oblique'
}

function isAllowedLineHeightValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    return n > 0 && n <= 4
  }
  return isAllowedFontSizeValue(trimmed)
}

function isAllowedLetterSpacingValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'normal') return true
  const match = trimmed.match(/^(-?\d+(\.\d+)?)(px|em|rem)$/)
  if (!match) return false
  const amount = Math.abs(Number(match[1]))
  return amount <= 2
}

function isAllowedBoxSpacingValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === '0') return true
  // Allow up to 4-value shorthand with px/em/rem.
  const parts = trimmed.split(/\s+/)
  if (parts.length > 4) return false
  return parts.every((part) => part === '0' || /^\d+(\.\d+)?(px|em|rem)$/.test(part))
}

function isAllowedBorderEdgeValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.length > 80) return false
  if (trimmed.includes('url(') || trimmed.includes('expression') || trimmed.includes('javascript')) return false
  // e.g. "1px solid #0f766e"
  return /^(0|\d+(\.\d+)?px)\s+solid\s+(transparent|currentcolor|#[0-9a-f]{3,8}|rgba?\([^)]+\))$/i.test(trimmed)
}

/** Safe CSS colors only (hex / rgb / rgba / transparent). No url()/expression. */
function isAllowedCssColorValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.length > 64) return false
  if (trimmed.includes('url(') || trimmed.includes('expression') || trimmed.includes('javascript')) return false
  if (trimmed === 'transparent' || trimmed === 'inherit' || trimmed === 'currentcolor') return true
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return true
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(trimmed)) return true
  return false
}

function collectAllowedStyles(el: HTMLElement): string[] {
  const kept: string[] = []
  const allowTableLayout = TABLE_STYLE_TAGS.has(el.tagName)
  const allowTextAlign = TEXT_ALIGN_TAGS.has(el.tagName)
  const allowIndent = INDENT_TAGS.has(el.tagName)
  const allowTypography = TYPOGRAPHY_TAGS.has(el.tagName)

  for (let index = 0; index < el.style.length; index += 1) {
    const prop = el.style.item(index)
    const value = el.style.getPropertyValue(prop).trim()
    if (!value) continue

    if (allowTableLayout && TABLE_LAYOUT_STYLE_PROPS.has(prop) && isAllowedTableLayoutValue(prop, value)) {
      kept.push(`${prop}: ${value}`)
      continue
    }
    if (allowTextAlign && TEXT_ALIGN_STYLE_PROPS.has(prop) && isAllowedTextAlignValue(value)) {
      kept.push(`${prop}: ${value}`)
      continue
    }
    if (allowIndent && INDENT_STYLE_PROPS.has(prop) && isAllowedIndentValue(value)) {
      kept.push(`${prop}: ${value}`)
      continue
    }
    if (allowTypography && TYPOGRAPHY_STYLE_PROPS.has(prop)) {
      if (prop === 'font-family' && isAllowedFontFamilyValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if (prop === 'font-size' && isAllowedFontSizeValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if (prop === 'font-weight' && isAllowedFontWeightValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if (prop === 'font-style' && isAllowedFontStyleValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if (prop === 'line-height' && isAllowedLineHeightValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if (prop === 'letter-spacing' && isAllowedLetterSpacingValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if (prop === 'text-transform' && isAllowedTextTransformValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if ((prop === 'color' || prop === 'background-color') && isAllowedCssColorValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if ((prop === 'margin' || prop.startsWith('margin-') || prop === 'padding' || prop.startsWith('padding-'))
        && isAllowedBoxSpacingValue(value)) {
        kept.push(`${prop}: ${value}`)
        continue
      }
      if ((prop === 'border-top' || prop === 'border-bottom') && isAllowedBorderEdgeValue(value)) {
        kept.push(`${prop}: ${value}`)
      }
    }
  }

  return kept
}

/**
 * Drop inline styles that are not allowlisted table layout / text-align / indent / typography.
 * Prevents contentEditable / paste from saving Tailwind --tw-* dumps that blow past
 * the API content max_length (50000).
 */
export function scrubKbInlineStyles(content: string): string {
  if (!content || typeof document === 'undefined') return content
  if (!content.includes('style')) return content

  const root = document.createElement('div')
  root.innerHTML = content
  let changed = false

  root.querySelectorAll('[style]').forEach((node) => {
    const el = node as HTMLElement
    const kept = collectAllowedStyles(el)
    const next = kept.join('; ')
    const prev = el.getAttribute('style') ?? ''

    if (!next) {
      el.removeAttribute('style')
      changed = true
      return
    }
    if (prev.replace(/\s+/g, '') !== next.replace(/\s+/g, '')) {
      el.setAttribute('style', next)
      changed = true
    }
  })

  return changed ? root.innerHTML : content
}

/** Clear unsafe inline styles on a live element tree; keep allowlisted styles. */
export function scrubLiveKbElementStyles(root: HTMLElement): void {
  root.querySelectorAll('[style]').forEach((node) => {
    const el = node as HTMLElement
    const kept = collectAllowedStyles(el)
    el.removeAttribute('style')
    for (const declaration of kept) {
      const [prop, ...rest] = declaration.split(':')
      const value = rest.join(':').trim()
      if (prop && value) el.style.setProperty(prop.trim(), value)
    }
  })
}
