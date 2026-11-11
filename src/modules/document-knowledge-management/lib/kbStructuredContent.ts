import DOMPurify from 'dompurify'
import { replaceExtractedTextControls } from '@/lib/kb/replaceExtractedTextControls'
import { repairKbInlineBoldHtml } from '@/lib/kb/kbInlineBoldRepair'
import { scrubKbInlineStyles } from '@/lib/kb/kbInlineStyleScrub'
import { hydrateKbDocStyleInlineStyles } from '@/lib/kb/kbRichTextStyles'
import { sanitizeKbRichHtmlPreservingTables, applyKbTableLayoutStylesFromAttrs } from '@/lib/kb/kbRichTableHtml'
import { kbLooksLikeHtml } from './kbStructuredAnswer'

export function kbExtractPlainText(content: string): string {
  if (!content) return ''
  if (typeof document === 'undefined') {
    return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const root = document.createElement('div')
  root.innerHTML = content
  return (root.textContent ?? '').replace(/\u00a0/g, ' ')
}

export function kbExtractPlainTextPreserveStructure(content: string): string {
  if (!content) return ''

  if (typeof document === 'undefined') {
    return content
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(p|h1|h2|h3|li|blockquote|pre|div|section|article|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (!kbLooksLikeHtml(content)) {
    return content
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const root = document.createElement('div')
  root.innerHTML = sanitizeKbRichHtml(content)

  const asInnerText = (root as HTMLDivElement).innerText ?? ''
  if (asInnerText.trim()) {
    return asInnerText
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return (root.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type KbStructureLexicon = {
  headings: string[]
  subsections: string[]
  listPhrases: string[]
}

let kbStructureLexicon: KbStructureLexicon = {
  headings: [],
  subsections: [],
  listPhrases: [],
}

const normalizeKbLexiconKey = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim()

const isTitleLikeLexiconLine = (line: string): boolean => {
  return /^[A-Z][A-Za-z0-9&()/' -]{2,90}$/.test(line)
    && !/[.!?]$/.test(line)
}

function extractKbLexiconCandidatesFromText(text: string): string[] {
  const plain = replaceExtractedTextControls(kbExtractPlainTextPreserveStructure(text).replace(/\r\n/g, '\n'), ' ', false)
  const lines = plain
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s+/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  return Array.from(new Set(lines))
}

export function primeKbStructureLexicon(...sources: string[]): void {
  const headingMap = new Map<string, string>()
  const subsectionMap = new Map<string, string>()
  const phraseMap = new Map<string, string>()

  sources.forEach((source) => {
    extractKbLexiconCandidatesFromText(source).forEach((line) => {
      const key = normalizeKbLexiconKey(line)
      if (!key) return

      // Collect list-phrase candidates for run-on recovery.
      if (line.length >= 3 && line.length <= 120) {
        if (!phraseMap.has(key)) phraseMap.set(key, line)
      }

      // Heading candidates: concise title-style lines.
      if (isTitleLikeLexiconLine(line) && line.split(/\s+/).length <= 7) {
        if (!headingMap.has(key)) headingMap.set(key, line)
      }

      // Subsection candidates: slightly longer title-style lines.
      if (isTitleLikeLexiconLine(line) && line.split(/\s+/).length <= 9) {
        if (!subsectionMap.has(key)) subsectionMap.set(key, line)
      }
    })
  })

  kbStructureLexicon = {
    headings: Array.from(headingMap.values()),
    subsections: Array.from(subsectionMap.values()),
    listPhrases: Array.from(phraseMap.values()),
  }
}

function getKbStructureLexicon(): KbStructureLexicon {
  return kbStructureLexicon
}

export function restoreKbSoftLineBreaks(value: string): string {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[ \t]+/g, ' ')
    .trim()

  if (!normalized) return ''

  const lexicon = getKbStructureLexicon()
  const inlineHeadingCandidates = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => isTitleLikeLexiconLine(line) && line.split(/\s+/).length <= 7)

  const knownHeadings = Array.from(new Set([...lexicon.headings, ...inlineHeadingCandidates]))
  const knownSubsections = lexicon.subsections

  const insertBreakBeforePhrase = (input: string, phrase: string, forceCamelBoundary = false): string => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const rx = new RegExp(escaped, 'gi')
    return input.replace(rx, (match, offset: number, whole: string) => {
      const prev = offset > 0 ? whole[offset - 1] : ''
      const next = offset + match.length < whole.length ? whole[offset + match.length] : ''

      const prevIsAlphaNum = /[A-Za-z0-9]/.test(prev)
      const nextIsAlphaNum = /[A-Za-z0-9]/.test(next)
      const allowCamelBoundary = forceCamelBoundary && /[a-z0-9]/.test(prev) && /[A-Z]/.test(match.charAt(0))

      if ((prevIsAlphaNum || nextIsAlphaNum) && !allowCamelBoundary) {
        return match
      }

      if (offset <= 0) return match
      if (prev === '\n') return match
      return `\n${match}`
    })
  }

  let restored = normalized
  for (const heading of knownHeadings) {
    restored = insertBreakBeforePhrase(restored, heading, true)
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const rx = new RegExp(escaped, 'gi')
    restored = restored.replace(rx, (m) => `${m}\n`)
  }

  for (const label of knownSubsections) {
    restored = insertBreakBeforePhrase(restored, label, true)
  }

  restored = restored
    .replace(/:\s+/g, ':\n')
    .replace(/\n +/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return restored
}

function isLikelyKbSubsectionLabel(line: string, nextNonEmptyLine: string): boolean {
  // Generic sub-section label heuristic: short title-style line followed by list-like content.
  const looksLikeTitle = /^[A-Z][A-Za-z0-9&()/' -]{2,70}$/.test(line)
    && !/[.:;!?]$/.test(line)
    && line.split(/\s+/).length <= 7
  if (!looksLikeTitle) return false

  if (!nextNonEmptyLine) return false

  const nextTrimmed = nextNonEmptyLine.trim()
  if (!nextTrimmed) return false

  const nextIsBullet = /^[-*•]\s+/.test(nextTrimmed)
  const nextSplitsByKnownPhrases = splitKbRunOnLineByKnownPhrases(nextTrimmed).length > 1
  const nextLooksLikeShortItem = /^[A-Za-z][A-Za-z0-9&()/' -]{1,80}$/.test(nextTrimmed)
    && !/[.:;!?]$/.test(nextTrimmed)
    && nextTrimmed.split(/\s+/).length <= 8

  return nextIsBullet || nextSplitsByKnownPhrases || nextLooksLikeShortItem
}

function splitKbRunOnLineByKnownPhrases(value: string): string[] {
  const line = value.replace(/\s+/g, ' ').trim()
  if (!line) return []

  const normalizedCatalog = Array.from(new Set(getKbStructureLexicon().listPhrases.map((item) => item.trim()).filter(Boolean)))
    .sort((a, b) => b.length - a.length)

  const escapedAlternatives = normalizedCatalog
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'))
    .join('|')
  if (!escapedAlternatives) return [line]

  const matcher = new RegExp(escapedAlternatives, 'gi')
  const items: string[] = []
  let match: RegExpExecArray | null

  while ((match = matcher.exec(line)) !== null) {
    const matched = (match[0] ?? '').replace(/\s+/g, ' ').trim()
    if (matched) items.push(matched)
  }

  if (items.length === 0) return [line]
  return items
}

const KB_ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'div', 'blockquote', 'a', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col']

// style is kept for table layout + text-align + indent + typography; DOMPurify still strips event handlers.
const KB_ALLOWED_ATTR = [
  'href', 'target', 'rel', 'colspan', 'rowspan', 'width', 'height', 'style',
  'data-kb-header-row', 'data-kb-first-column', 'data-kb-total-row',
  'data-kb-last-column', 'data-kb-banded-rows', 'data-kb-banded-columns',
  'data-kb-style', 'data-kb-table-index',
]

/**
 * Sanitize KB rich HTML with DOMPurify (vetted, mXSS-resistant) using a strict allowlist.
 * Applied both on render (before dangerouslySetInnerHTML) and on save. Anchors are hardened
 * with target=_blank + rel=noopener via a scoped post-pass on the already-sanitized output
 * (no global DOMPurify hooks, so other call sites are unaffected).
 */
export function sanitizeKbRichHtml(content: string): string {
  if (!content) return ''
  if (typeof window === 'undefined' || typeof document === 'undefined') return content

  // Fix contentEditable bold quirks before allowlist sanitize (e.g. name<b><br></b>desc).
  const repairedBold = repairKbInlineBoldHtml(content)
  // Strip Tailwind --tw-* / paste style dumps that inflate content past the 50k API limit.
  const scrubbedStyles = scrubKbInlineStyles(repairedBold)
  // Bake Word-like style visuals into inline styles so View matches Editor.
  const hydratedStyles = hydrateKbDocStyleInlineStyles(scrubbedStyles)
  const scrubbedHydrated = scrubKbInlineStyles(hydratedStyles)

  const runPurify = (html: string) => DOMPurify.sanitize(html, {
    ALLOWED_TAGS: KB_ALLOWED_TAGS,
    ALLOWED_ATTR: KB_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
    ALLOW_DATA_ATTR: false,
  })

  const clean = sanitizeKbRichHtmlPreservingTables(scrubbedHydrated, runPurify)

  if (!clean.includes('<a')) {
    const trimmedOnly = clean.trim()
    const withLayout = applyKbTableLayoutStylesFromAttrs(trimmedOnly === '<br>' ? '' : trimmedOnly)
    return withLayout
  }

  const root = document.createElement('div')
  root.innerHTML = clean
  root.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noreferrer noopener')
  })

  const sanitizedHtml = root.innerHTML.trim()
  const withLayout = applyKbTableLayoutStylesFromAttrs(sanitizedHtml === '<br>' ? '' : sanitizedHtml)
  return withLayout
}

export function escapeKbHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderKbInlineTextAsHtml(value: string): string {
  const escaped = escapeKbHtml(value)
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function normalizeKbHeadingKey(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripSectionHeadingFromChunkHtml(value: string, sectionName: string): string {
  const safeHtml = sanitizeKbRichHtml(value)
  if (!safeHtml) return ''
  if (typeof document === 'undefined') return safeHtml

  const targetKey = normalizeKbHeadingKey(sectionName)
  if (!targetKey) return safeHtml

  const root = document.createElement('div')
  root.innerHTML = safeHtml

  root.querySelectorAll('h2,h3').forEach((node) => {
    const key = normalizeKbHeadingKey(node.textContent ?? '')
    if (key === targetKey) {
      node.remove()
    }
  })

  return sanitizeKbRichHtml(root.innerHTML)
}

export function combineKbStructuredChunksBySection(
  chunks: Array<{ sectionName: string | null; html: string }>,
  sectionOrder: string[]
): string {
  const intro: string[] = []
  const sectionBuckets = new Map<string, string[]>()
  const sectionLabelMap = new Map<string, string>()

  const normalizedOrder = sectionOrder
    .map((name) => ({ key: normalizeKbHeadingKey(name), name }))
    .filter((item) => item.key)

  for (const item of normalizedOrder) {
    if (!sectionBuckets.has(item.key)) sectionBuckets.set(item.key, [])
    sectionLabelMap.set(item.key, item.name)
  }

  for (const chunk of chunks) {
    const safeHtml = sanitizeKbRichHtml(chunk.html)
    if (!safeHtml) continue

    const sectionName = (chunk.sectionName ?? '').trim()
    const sectionKey = normalizeKbHeadingKey(sectionName)
    if (!sectionKey) {
      intro.push(safeHtml)
      continue
    }

    const bucket = sectionBuckets.get(sectionKey) ?? []
    const cleanedHtml = bucket.length > 0 ? stripSectionHeadingFromChunkHtml(safeHtml, sectionName) : safeHtml
    if (cleanedHtml.trim()) bucket.push(cleanedHtml)

    if (!sectionBuckets.has(sectionKey)) sectionBuckets.set(sectionKey, bucket)
    if (!sectionLabelMap.has(sectionKey)) sectionLabelMap.set(sectionKey, sectionName)
  }

  const orderedSections: string[] = []
  normalizedOrder.forEach((item) => orderedSections.push(item.key))
  Array.from(sectionBuckets.keys()).forEach((key) => {
    if (!orderedSections.includes(key)) orderedSections.push(key)
  })

  const combined: string[] = []
  if (intro.length > 0) combined.push(intro.join('\n'))

  for (const sectionKey of orderedSections) {
    const sectionParts = sectionBuckets.get(sectionKey) ?? []
    if (sectionParts.length === 0) continue

    const firstPart = sectionParts[0]
    if (firstPart) {
      combined.push(firstPart)
    }

    if (sectionParts.length > 1) {
      for (let i = 1; i < sectionParts.length; i += 1) {
        const nextPart = sectionParts[i]
        if (nextPart && nextPart.trim()) combined.push(nextPart)
      }
    }
  }

  return sanitizeKbRichHtml(combined.join('\n'))
}

export function enforceCanonicalKbSections(value: string, sectionOrder: string[]): string {
  const safeHtml = sanitizeKbRichHtml(value)
  if (!safeHtml) return ''
  if (typeof document === 'undefined') return safeHtml

  const canonical = sectionOrder
    .map((name) => ({ key: normalizeKbHeadingKey(name), label: name.trim() }))
    .filter((item) => item.key)
  if (canonical.length === 0) return safeHtml

  const canonicalMap = new Map(canonical.map((item) => [item.key, item.label]))
  const sectionBuckets = new Map<string, string[]>()
  canonical.forEach((item) => sectionBuckets.set(item.key, []))
  const introParts: string[] = []

  const root = document.createElement('div')
  root.innerHTML = safeHtml

  let activeSectionKey: string | null = null

  // Traverse all block nodes in document order so nested headings cannot bypass canonical enforcement.
  const blocks = Array.from(root.querySelectorAll('h2,h3,p,ul,ol,pre,blockquote'))
  blocks.forEach((node) => {
    if (/H2|H3/.test(node.tagName)) {
      const heading = (node.textContent ?? '').trim()
      const key = normalizeKbHeadingKey(heading)
      if (key && canonicalMap.has(key)) {
        activeSectionKey = key
        return
      }

      // Unknown heading is demoted to emphasis within current section to avoid creating rogue top-level sections.
      const demoted = `<p><strong>${escapeKbHtml(heading)}</strong></p>`
      if (activeSectionKey) {
        const bucket = sectionBuckets.get(activeSectionKey)
        if (bucket) bucket.push(demoted)
      } else {
        introParts.push(demoted)
      }
      return
    }

    const html = node.outerHTML.trim()
    if (!html) return

    if (activeSectionKey) {
      const bucket = sectionBuckets.get(activeSectionKey)
      if (bucket) bucket.push(html)
    } else {
      introParts.push(html)
    }
  })

  const output: string[] = []
  if (introParts.length > 0) output.push(introParts.join('\n'))

  canonical.forEach(({ key, label }) => {
    const parts = sectionBuckets.get(key) ?? []
    if (parts.length === 0) return
    output.push(`<h2>${escapeKbHtml(label)}</h2>`)
    output.push(parts.join('\n'))
  })

  return sanitizeKbRichHtml(output.join('\n'))
}

export function listUnknownKbHeadings(value: string, sectionOrder: string[]): string[] {
  const safeHtml = sanitizeKbRichHtml(value)
  if (!safeHtml) return []
  if (typeof document === 'undefined') return []

  const canonicalKeys = new Set(sectionOrder.map((name) => normalizeKbHeadingKey(name)).filter(Boolean))
  if (canonicalKeys.size === 0) return []

  const root = document.createElement('div')
  root.innerHTML = safeHtml

  const unknown: string[] = []
  root.querySelectorAll('h2,h3').forEach((node) => {
    const label = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!label) return
    const key = normalizeKbHeadingKey(label)
    if (!key || !canonicalKeys.has(key)) {
      unknown.push(label)
    }
  })
  return Array.from(new Set(unknown))
}

export function normalizeKbPlainTextForComparison(value: string): string {
  const normalizeText = (input: string) => input
    .replaceAll('\0', ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim()

  const raw = value ?? ''

  if (kbLooksLikeHtml(raw) && typeof document !== 'undefined') {
    const root = document.createElement('div')
    root.innerHTML = sanitizeKbRichHtml(raw)

    const blockTexts = Array.from(root.querySelectorAll('h1,h2,h3,p,li,blockquote,pre'))
      .map((node) => (node.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    if (blockTexts.length > 0) {
      return normalizeText(blockTexts.join(' '))
    }
  }

  return normalizeText(kbExtractPlainText(raw))
}

export function validateKbStructuredContentPreservesSource(sourceValue: string, structuredValue: string): { valid: boolean; reason?: string } {
  const toTokenList = (input: string): string[] => (
    input.toLowerCase().match(/[a-z0-9]+(?:[._:/-][a-z0-9]+)*/g) ?? []
  )

  const toTokenCountMap = (tokens: string[]): Map<string, number> => {
    const counts = new Map<string, number>()
    tokens.forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1)
    })
    return counts
  }

  const sourcePlain = normalizeKbPlainTextForComparison(sourceValue)
  const structuredPlain = normalizeKbPlainTextForComparison(structuredValue)

  if (!sourcePlain && !structuredPlain) {
    return { valid: true }
  }

  if (!sourcePlain) {
    return { valid: false, reason: 'Source content is empty after normalization.' }
  }

  if (!structuredPlain) {
    return { valid: false, reason: 'Structured output is empty after normalization.' }
  }

  if (sourcePlain === structuredPlain) {
    return { valid: true }
  }

  const sourceTokens = toTokenList(sourcePlain)
  const structuredTokens = toTokenList(structuredPlain)
  if (sourceTokens.length < 12 || structuredTokens.length < 12) {
    return { valid: false, reason: 'Structured output changes the source wording or content order.' }
  }

  const sourceTokenCounts = toTokenCountMap(sourceTokens)
  const structuredTokenCounts = toTokenCountMap(structuredTokens)

  const isCriticalToken = (token: string): boolean => {
    if (/\d/.test(token)) return true // numbers/version/date-like tokens must be exact
    if (/[._:/-]/.test(token)) return true // id/code-like token must be exact
    if (token.length >= 12) return true // long domain terms are treated as critical
    return false
  }

  for (const [token, count] of sourceTokenCounts.entries()) {
    if (!isCriticalToken(token)) continue
    if ((structuredTokenCounts.get(token) ?? 0) !== count) {
      return { valid: false, reason: 'Structured output changes the source wording or content order.' }
    }
  }

  // Allow very small wording drift from LLM formatting as long as token coverage stays high.
  let missingTokens = 0
  let addedTokens = 0

  for (const [token, count] of sourceTokenCounts.entries()) {
    const other = structuredTokenCounts.get(token) ?? 0
    if (other < count) missingTokens += (count - other)
  }
  for (const [token, count] of structuredTokenCounts.entries()) {
    const other = sourceTokenCounts.get(token) ?? 0
    if (other < count) addedTokens += (count - other)
  }

  const sourceTotal = sourceTokens.length
  const structuredTotal = structuredTokens.length
  const missingRatio = sourceTotal > 0 ? (missingTokens / sourceTotal) : 0
  const addedRatio = structuredTotal > 0 ? (addedTokens / structuredTotal) : 0

  const missingAllowedAbsolute = Math.max(2, Math.ceil(sourceTotal * 0.06))
  const addedAllowedAbsolute = Math.max(2, Math.ceil(structuredTotal * 0.06))

  if (missingRatio > 0.12 || addedRatio > 0.12) {
    return { valid: false, reason: 'Structured output changes the source wording or content order.' }
  }

  if (missingTokens > missingAllowedAbsolute || addedTokens > addedAllowedAbsolute) {
    return { valid: false, reason: 'Structured output changes the source wording or content order.' }
  }

  return { valid: true }
}

export function renderKbPlainTextAsDeterministicStructuredHtml(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''

  const lines = normalized.split('\n')
  const headerMap = new Map<number, string>()
  detectKbSectionHeaders(normalized).forEach((header) => {
    headerMap.set(header.index, header.name)
  })

  const blocks: string[] = []
  let listMode = false
  let listItems: string[] = []
  let activeSectionKey = ''
  const knownSubsectionKeySet = new Set(getKbStructureLexicon().subsections.map((label) => normalizeKbLexiconKey(label)))

  const ruleListSectionKeys = new Set([
    'rules',
    'language handling',
    'constraints',
    'formatting',
    'quality checklist',
  ])

  const isPromotableSubsectionLabel = (input: string, nextLine: string): boolean => {
    const trimmed = input.trim()
    if (!/[:：]$/.test(trimmed)) return false

    const label = trimmed.replace(/[:：]+$/, '').trim()
    if (!label) return false
    if (looksLikeJsonOrCodeLine(label)) return false
    if (label.split(/\s+/).length > 5) return false
    if (looksLikeJsonOrCodeLine(nextLine)) return false
    return true
  }

  const looksLikeJsonOrCodeLine = (input: string): boolean => {
    const line = input.trim()
    if (!line) return false
    if (/^[{}[\]]$/.test(line)) return true
    if (/^"[^"]+"\s*:\s*/.test(line)) return true
    if (/^\{.*:.*\}$/.test(line)) return true
    return false
  }

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderKbInlineTextAsHtml(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()

    if (!line) {
      flushList()
      listMode = false
      continue
    }

    const header = headerMap.get(i)
    if (header) {
      flushList()
      listMode = false
      blocks.push(`<h2>${renderKbInlineTextAsHtml(header)}</h2>`)
      activeSectionKey = normalizeKbHeadingKey(header)
      continue
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/)
    if (bullet) {
      listItems.push(bullet[1].trim())
      continue
    }

    let nextNonEmptyLine = ''
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j].trim()
      if (candidate) {
        nextNonEmptyLine = candidate
        break
      }
    }

    const normalizedLineKey = line.toLowerCase().replace(/\s+/g, ' ').trim()
    const isKnownSubsection = knownSubsectionKeySet.has(normalizedLineKey)
    const isAdaptiveSubsection = !listMode && isLikelyKbSubsectionLabel(line, nextNonEmptyLine)

    if (isKnownSubsection || isAdaptiveSubsection) {
      flushList()
      listMode = true
      blocks.push(`<p><strong>${renderKbInlineTextAsHtml(line)}</strong></p>`)
      continue
    }

    if (ruleListSectionKeys.has(activeSectionKey) && !looksLikeJsonOrCodeLine(line)) {
      listMode = true
      listItems.push(line)
      continue
    }

    const inlineList = line.match(/^(.+?:)\s*(.+)$/)
    if (inlineList) {
      const head = (inlineList[1] ?? '').trim()
      const tail = (inlineList[2] ?? '').trim()
      if (head) {
        flushList()
        blocks.push(`<h3>${renderKbInlineTextAsHtml(head.replace(/:+$/, ''))}</h3>`)
      }
      if (tail) {
        const detectedInlineItems = splitKbRunOnLineByKnownPhrases(tail)
        if (detectedInlineItems.length > 1) {
          listItems.push(...detectedInlineItems)
          flushList()
          listMode = false
          continue
        }
      }
    }

    if (listMode) {
      const detected = splitKbRunOnLineByKnownPhrases(line)
      if (detected.length > 1) {
        listItems.push(...detected)
      } else {
        listItems.push(line)
      }
      continue
    }

    if (isPromotableSubsectionLabel(line, nextNonEmptyLine)) {
      const label = line.replace(/[:：]+$/, '').trim()
      flushList()
      blocks.push(`<h3>${renderKbInlineTextAsHtml(label)}</h3>`)
      const nextLooksLikeBullet = /^[-*•]\s+/.test(nextNonEmptyLine)
      const nextSplitsByKnownPhrases = splitKbRunOnLineByKnownPhrases(nextNonEmptyLine).length > 1
      const nextLooksLikeShortListItem = /^[A-Za-z][A-Za-z0-9&()/' -]{1,80}$/.test(nextNonEmptyLine)
        && !/[.,;!?]$/.test(nextNonEmptyLine)
        && nextNonEmptyLine.split(/\s+/).length <= 8
      const nextLooksLikeJsonOrCode = looksLikeJsonOrCodeLine(nextNonEmptyLine)

      listMode = !nextLooksLikeJsonOrCode && (nextLooksLikeBullet || nextSplitsByKnownPhrases || nextLooksLikeShortListItem)
      continue
    }

    blocks.push(`<p>${renderKbInlineTextAsHtml(line)}</p>`)
  }

  flushList()
  return sanitizeKbRichHtml(blocks.join('\n'))
}

export function renderKbPlainTextAsStrictPreservedHtml(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''

  const lines = normalized.split('\n')
  const headerMap = new Map<number, string>()
  detectKbSectionHeaders(normalized).forEach((header) => {
    headerMap.set(header.index, header.name)
  })

  const blocks: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) continue

    const header = headerMap.get(i)
    if (header) {
      blocks.push(`<h2>${renderKbInlineTextAsHtml(header)}</h2>`)
      continue
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/)
    if (bullet) {
      blocks.push(`<ul><li>${renderKbInlineTextAsHtml(bullet[1].trim())}</li></ul>`)
      continue
    }

    blocks.push(`<p>${renderKbInlineTextAsHtml(line)}</p>`)
  }

  return sanitizeKbRichHtml(blocks.join('\n'))
}

export const KB_AI_STRUCTURE_CHUNK_MAX_CHARS = 1200

interface KbSectionChunk {
  content: string
  sectionNames: string[]
  chunkIndex: number
  totalChunks: number
}

export function detectKbSectionHeaders(text: string): { name: string; index: number }[] {
  const lines = text.split('\n')
  const headers: { name: string; index: number }[] = []
  const knownHeadingSet = new Set(getKbStructureLexicon().headings.map((item) => normalizeKbLexiconKey(item)))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Pattern 1: All uppercase (or mostly uppercase) with some words = section header
    const isAllCaps = /^[A-Z][A-Z\s&()_-]*$/.test(line) && line.length > 2 && line.length < 100
    // Pattern 2: Title Case pattern with no sentence structure (no period/comma/etc)
    const isTitleCase = /^[A-Z][A-Za-z0-9\s&()_-]*$/.test(line)
      && !/[.,:;!?]/.test(line)
      && line.length < 80
      && line.split(/\s+/).length <= 5
      && /[A-Za-z0-9)]/.test(line.charAt(line.length - 1))

    const lowerLine = line.toLocaleLowerCase('en-US')
    const isKnownHeading = knownHeadingSet.has(lowerLine)
    const prevLine = i > 0 ? lines[i - 1].trim() : ''
    const isLikelyStandaloneHeader = isKnownHeading || prevLine.length === 0

    if ((isAllCaps || isTitleCase) && isLikelyStandaloneHeader && line.length > 3) {
      // Avoid false positives: skip if next line is empty or very short
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
      if (nextLine && nextLine.length > 10) {
        headers.push({ name: line, index: i })
      }
    }
  }

  return headers
}

export function splitKbBySectionAware(value: string, maxChars = KB_AI_STRUCTURE_CHUNK_MAX_CHARS): KbSectionChunk[] {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const headers = detectKbSectionHeaders(normalized)
  if (headers.length === 0) {
    // Fallback to paragraph-based chunking if no sections detected
    const fallbackChunks = splitKbPlainTextForAi(normalized, maxChars)
    return fallbackChunks.map((content, index) => ({
      content,
      sectionNames: [],
      chunkIndex: index,
      totalChunks: fallbackChunks.length,
    }))
  }

  const lines = normalized.split('\n')
  const chunks: KbSectionChunk[] = []
  const sortedHeaders = [...headers].sort((a, b) => a.index - b.index)

  const firstHeaderIndex = sortedHeaders[0]?.index ?? -1
  if (firstHeaderIndex > 0) {
    const introText = lines.slice(0, firstHeaderIndex).join('\n').trim()
    if (introText) {
      const introParts = splitKbPlainTextForAi(introText, maxChars)
      introParts.forEach((part) => {
        chunks.push({
          content: part,
          sectionNames: [],
          chunkIndex: chunks.length,
          totalChunks: 0,
        })
      })
    }
  }

  for (let h = 0; h < sortedHeaders.length; h += 1) {
    const header = sortedHeaders[h]
    const headerName = header.name.trim()
    const sectionStart = header.index
    const sectionEnd = h + 1 < sortedHeaders.length ? sortedHeaders[h + 1].index : lines.length
    const sectionLines = lines.slice(sectionStart, sectionEnd)
    const sectionText = sectionLines.join('\n').trim()
    if (!sectionText) continue

    if (sectionText.length <= maxChars) {
      chunks.push({
        content: sectionText,
        sectionNames: [headerName],
        chunkIndex: chunks.length,
        totalChunks: 0,
      })
      continue
    }

    const bodyText = lines.slice(sectionStart + 1, sectionEnd).join('\n').trim()
    if (!bodyText) {
      chunks.push({
        content: sectionText.slice(0, maxChars),
        sectionNames: [headerName],
        chunkIndex: chunks.length,
        totalChunks: 0,
      })
      continue
    }

    const bodyParts = splitKbPlainTextForAi(bodyText, Math.max(500, maxChars - headerName.length - 2))
    bodyParts.forEach((part) => {
      const content = `${headerName}\n${part}`
      chunks.push({
        content,
        sectionNames: [headerName],
        chunkIndex: chunks.length,
        totalChunks: 0,
      })
    })
  }

  // Update total chunk count for all
  const totalChunks = chunks.length
  chunks.forEach((chunk) => {
    chunk.totalChunks = totalChunks
  })

  return chunks
}

function splitKbPlainTextForAi(value: string, maxChars = KB_AI_STRUCTURE_CHUNK_MAX_CHARS): string[] {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  if (paragraphs.length === 0) return []

  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    const safe = current.trim()
    if (safe) chunks.push(safe)
    current = ''
  }

  const appendPart = (part: string) => {
    if (!part) return
    const candidate = current ? `${current}\n\n${part}` : part
    if (candidate.length <= maxChars) {
      current = candidate
      return
    }

    if (current) pushCurrent()

    if (part.length <= maxChars) {
      current = part
      return
    }

    // Fallback for extra-long paragraph: split by words while preserving order.
    const words = part.split(/\s+/).filter(Boolean)
    let wordChunk = ''
    for (const word of words) {
      const wordCandidate = wordChunk ? `${wordChunk} ${word}` : word
      if (wordCandidate.length <= maxChars) {
        wordChunk = wordCandidate
        continue
      }

      if (wordChunk) chunks.push(wordChunk)
      wordChunk = word.length <= maxChars ? word : word.slice(0, maxChars)
    }

    if (wordChunk) chunks.push(wordChunk)
  }

  paragraphs.forEach(appendPart)
  if (current) pushCurrent()

  return chunks
}
