/** Repair contentEditable bold quirks so emphasis survives sanitize/save. */

const BLOCK_OR_DOC_STYLE_TAGS = new Set(['H1', 'H2', 'H3', 'P', 'LI', 'BLOCKQUOTE', 'DIV', 'TD', 'TH', 'A'])

function isBoldFontWeight(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return false
  if (trimmed === 'bold' || trimmed === 'bolder') return true
  const numeric = Number.parseInt(trimmed, 10)
  return Number.isFinite(numeric) && numeric >= 600
}

function hasNonBoldTypography(el: HTMLElement): boolean {
  const style = el.style
  return Boolean(
    style.fontSize
    || style.fontFamily
    || style.color
    || style.backgroundColor
    || style.fontStyle
    || style.textTransform
    || style.letterSpacing
    || style.lineHeight
    || style.textAlign
    || style.margin
    || style.marginTop
    || style.marginBottom
    || style.padding
    || style.borderTop
    || style.borderBottom
    || el.getAttribute('data-kb-style'),
  )
}

/**
 * contentEditable often produces broken bold markup such as:
 *   adira.co.id<b><br></b>Website...
 * instead of:
 *   <strong>adira.co.id</strong><br>Website...
 *
 * Converts *simple* span/font-weight bold into semantic <strong>, but never destroys
 * Word-like styles (font-size/color/data-kb-style) that must survive save → View.
 */
export function repairKbInlineBoldHtml(content: string): string {
  if (!content || typeof document === 'undefined') return content

  const root = document.createElement('div')
  root.innerHTML = content
  let changed = false

  // 1) Empty/misplaced <b>/<strong> that only wrap <br> — move emphasis onto previous text.
  root.querySelectorAll('b, strong').forEach((node) => {
    const el = node as HTMLElement
    const childElements = Array.from(el.children)
    const onlyBreak = childElements.length === 1
      && childElements[0]?.tagName === 'BR'
      && (el.textContent ?? '').trim() === ''
    if (!onlyBreak) return

    const prev = el.previousSibling
    if (prev && prev.nodeType === Node.TEXT_NODE && (prev.textContent ?? '').trim()) {
      const strong = document.createElement('strong')
      strong.textContent = prev.textContent
      prev.parentNode?.replaceChild(strong, prev)
      const br = document.createElement('br')
      el.replaceWith(br)
      changed = true
      return
    }

    const br = document.createElement('br')
    el.replaceWith(br)
    changed = true
  })

  // 2) Bold-only spans → <strong>. Keep richer styled nodes intact.
  root.querySelectorAll('[style]').forEach((node) => {
    const el = node as HTMLElement
    if (!isBoldFontWeight(el.style.fontWeight)) return

    if (el.tagName === 'STRONG' || el.tagName === 'B') {
      // Keep other typography on <strong>/<b>; only drop redundant font-weight.
      el.style.removeProperty('font-weight')
      changed = true
      return
    }

    // Never replace headings / blocks / doc-styled elements — that wiped View styles.
    if (BLOCK_OR_DOC_STYLE_TAGS.has(el.tagName) || el.hasAttribute('data-kb-style')) {
      return
    }

    // Span (or similar) with ONLY bold → semantic <strong>.
    if (!hasNonBoldTypography(el)) {
      const strong = document.createElement('strong')
      while (el.firstChild) strong.appendChild(el.firstChild)
      el.replaceWith(strong)
      changed = true
      return
    }

    // Span with bold + other typography: wrap contents in <strong>, keep outer styles.
    if (el.tagName === 'SPAN') {
      el.style.removeProperty('font-weight')
      if (!el.querySelector(':scope > strong, :scope > b')) {
        const strong = document.createElement('strong')
        while (el.firstChild) strong.appendChild(el.firstChild)
        el.appendChild(strong)
      }
      changed = true
    }
  })

  // 3) Catalog-style list items: "AppName<br>Description" → "<strong>AppName</strong><br>Description"
  root.querySelectorAll('li').forEach((li) => {
    if (li.querySelector(':scope > strong, :scope > b')) return
    const html = li.innerHTML.trim()
    const match = html.match(/^([^<]+)<br\s*\/?>/i)
    if (!match) return
    const name = match[1].trim()
    if (!name || name.length > 120) return
    const rest = html.slice(match[0].length).trim()
    if (!rest) return
    li.innerHTML = `<strong>${name}</strong><br>${rest}`
    changed = true
  })

  return changed ? root.innerHTML : content
}
