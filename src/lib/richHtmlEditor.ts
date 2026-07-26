import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'a',
  'pre',
  'code',
]
const ALLOWED_ATTR = ['href', 'target', 'rel']

export function sanitizeRichHtml(content: string): string {
  if (!content) return ''
  if (typeof window === 'undefined' || typeof document === 'undefined') return content

  const clean = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
    ALLOW_DATA_ATTR: false,
  })

  if (!clean.includes('<a')) {
    const trimmedOnly = clean.trim()
    return trimmedOnly === '<br>' ? '' : trimmedOnly
  }

  const root = document.createElement('div')
  root.innerHTML = clean
  root.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noreferrer noopener')
  })

  const normalized = root.innerHTML.trim()
  return normalized === '<br>' ? '' : normalized
}

export function extractPlainTextFromHtml(content: string): string {
  if (!content) return ''
  if (typeof document === 'undefined') {
    return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const root = document.createElement('div')
  root.innerHTML = content
  return (root.textContent ?? '').replace(/\u00a0/g, ' ')
}

/** True when the editor has no text and no meaningful structure (lists, headings, code block, …). */
export function richHtmlEditorIsEmpty(html: string): boolean {
  const safe = sanitizeRichHtml(html)
  if (!safe) return true
  if (extractPlainTextFromHtml(safe).trim().length > 0) return false

  if (typeof document === 'undefined') {
    return !/<(ul|ol|li|h1|h2|h3|pre|blockquote)\b/i.test(safe)
  }

  const root = document.createElement('div')
  root.innerHTML = safe
  return root.querySelector('ul,ol,pre,blockquote,h1,h2,h3') === null
}

export function escapeRichHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function normalizeRichHtmlForStorage(html: string): string {
  const safe = sanitizeRichHtml(html)
  if (richHtmlEditorIsEmpty(safe)) return ''
  return safe
}

export const RICH_HTML_EDITOR_CONTENT_CLASS =
  'min-h-[170px] px-3 py-3 text-sm leading-6 text-foreground outline-none [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-slate-200 [&_pre]:bg-slate-50 [&_pre]:px-3 [&_pre]:py-2 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-6 [&_pre]:text-slate-800 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-slate-800'
