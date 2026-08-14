import type { RevisionDiffSegment } from '@/lib/documents/revisionContentHighlight'
import { resolveChangeAnchorId } from '@/modules/document-knowledge-management/lib/templateCompareSideBySide'

export type DocxHighlightSpec = {
  text: string
  kind: 'removed' | 'added'
  changeId: string | null
}

export function buildDocxHighlightSpecs(
  segments: RevisionDiffSegment[],
  side: 'server' | 'upload',
): DocxHighlightSpec[] {
  const specs: DocxHighlightSpec[] = []
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const normalized = segment.text.replace(/\s+/g, ' ').trim()
    if (!normalized || normalized.length < 2) continue
    if (side === 'server' && segment.type === 'removed') {
      specs.push({
        text: normalized,
        kind: 'removed',
        changeId: resolveChangeAnchorId(segments, index),
      })
    }
    if (side === 'upload' && segment.type === 'added') {
      specs.push({
        text: normalized,
        kind: 'added',
        changeId: resolveChangeAnchorId(segments, index),
      })
    }
  }
  return specs
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function highlightClass(kind: DocxHighlightSpec['kind']): string {
  return kind === 'removed'
    ? 'template-compare-mark template-compare-mark--removed'
    : 'template-compare-mark template-compare-mark--added'
}

function wrapRange(range: Range, className: string, changeId: string | null) {
  const mark = document.createElement('mark')
  mark.className = className
  if (changeId) mark.dataset.changeId = changeId
  try {
    range.surroundContents(mark)
    return true
  } catch {
    const fragment = range.extractContents()
    mark.appendChild(fragment)
    range.insertNode(mark)
    return true
  }
}

function findRangeForNeedle(root: HTMLElement, needle: string): Range | null {
  const target = collapseWhitespace(needle)
  if (!target) return null

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    if (node.textContent && node.textContent.length > 0) nodes.push(node as Text)
    node = walker.nextNode()
  }

  const starts: number[] = []
  let combined = ''
  for (const textNode of nodes) {
    starts.push(combined.length)
    combined += textNode.textContent ?? ''
  }

  const collapsedCombined = collapseWhitespace(combined)
  let collapsedIndex = collapsedCombined.indexOf(target)
  if (collapsedIndex < 0) return null

  // Map collapsed index back to raw combined index (best-effort for single-line edits).
  let rawStart = -1
  let rawEnd = -1
  let collapsedCursor = 0
  let inSpace = false
  for (let i = 0; i < combined.length; i += 1) {
    const ch = combined[i]
    const isSpace = /\s/.test(ch)
    if (isSpace) {
      if (!inSpace && collapsedCursor > 0) collapsedCursor += 1
      inSpace = true
      continue
    }
    inSpace = false
    if (collapsedCursor === collapsedIndex && rawStart < 0) rawStart = i
    if (collapsedCursor === collapsedIndex + target.length - 1) rawEnd = i + 1
    collapsedCursor += 1
  }
  if (rawStart < 0 || rawEnd < 0) {
    rawStart = combined.indexOf(target)
    rawEnd = rawStart >= 0 ? rawStart + target.length : -1
  }
  if (rawStart < 0 || rawEnd < 0) return null

  const locate = (offset: number): { node: Text; offset: number } | null => {
    for (let i = 0; i < nodes.length; i += 1) {
      const start = starts[i]
      const end = start + (nodes[i].textContent?.length ?? 0)
      if (offset >= start && offset <= end) {
        return { node: nodes[i], offset: offset - start }
      }
    }
    return null
  }

  const startPos = locate(rawStart)
  const endPos = locate(Math.max(rawStart, rawEnd - 1))
  if (!startPos || !endPos) return null

  const range = document.createRange()
  range.setStart(startPos.node, startPos.offset)
  range.setEnd(endPos.node, endPos.offset + (rawEnd > rawStart ? 1 : 0))
  return range
}

export function applyDocxHighlights(root: HTMLElement, specs: DocxHighlightSpec[]) {
  for (const spec of specs) {
    const range = findRangeForNeedle(root, spec.text)
    if (!range) continue
    wrapRange(range, highlightClass(spec.kind), spec.changeId)
  }
}

const DOCX_PAGE_WIDTH = 793.7

export const TEMPLATE_COMPARE_ZOOM_MIN = 0.5
export const TEMPLATE_COMPARE_ZOOM_MAX = 2
export const TEMPLATE_COMPARE_ZOOM_STEP = 0.1
export const TEMPLATE_COMPARE_ZOOM_DEFAULT = 1

export function fitDocxPreviewToContainer(container: HTMLElement, userZoom = TEMPLATE_COMPARE_ZOOM_DEFAULT) {
  const wrapper = container.querySelector('.docx-wrapper') as HTMLElement | null
  if (!wrapper) return

  const clampedZoom = Math.min(
    TEMPLATE_COMPARE_ZOOM_MAX,
    Math.max(TEMPLATE_COMPARE_ZOOM_MIN, userZoom),
  )
  const available = Math.max(container.clientWidth - 32, 280)
  const fitScale = Math.min(1, available / DOCX_PAGE_WIDTH)
  const scale = fitScale * clampedZoom
  const scaleKey = scale.toFixed(4)
  const slot = wrapper.parentElement

  if (wrapper.dataset.compareScaleKey === scaleKey) {
    const naturalHeight = wrapper.scrollHeight
    const scaledHeight = `${Math.ceil(naturalHeight * scale)}px`
    if (slot && slot.style.height !== scaledHeight) {
      slot.style.height = scaledHeight
    }
    return
  }

  wrapper.style.transformOrigin = 'top center'
  wrapper.style.transform = `scale(${scale})`
  wrapper.style.margin = '0 auto'
  wrapper.style.width = `${DOCX_PAGE_WIDTH}px`
  wrapper.dataset.compareScaleKey = scaleKey

  if (slot) {
    const naturalHeight = wrapper.scrollHeight
    slot.style.height = `${Math.ceil(naturalHeight * scale)}px`
  }
}

export type DocxPreviewStats = {
  pageCount: number
  wordCount: number
}

function countDocumentWords(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return 0
  return normalized.split(' ').filter(Boolean).length
}

export function readDocxPreviewStats(root: HTMLElement): DocxPreviewStats {
  const wrapper = root.querySelector('.docx-wrapper')
  const pageCount = wrapper?.querySelectorAll(':scope > section').length ?? 0
  const wordCount = countDocumentWords(root.textContent ?? '')
  return {
    pageCount: Math.max(pageCount, 1),
    wordCount,
  }
}

export function resolveVisibleDocxPageIndex(scrollContainer: HTMLElement): number {
  const sections = scrollContainer.querySelectorAll('.docx-wrapper > section')
  if (sections.length === 0) return 1

  const containerRect = scrollContainer.getBoundingClientRect()
  const focusY = containerRect.top + scrollContainer.clientHeight * 0.35

  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  sections.forEach((section, index) => {
    const rect = section.getBoundingClientRect()
    const sectionCenter = rect.top + rect.height / 2
    const distance = Math.abs(sectionCenter - focusY)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  return bestIndex + 1
}

/** Word exports may embed decorative form controls; keep them out of the a11y tree in read-only preview. */
export function sanitizeDocxPreviewFormFields(root: HTMLElement) {
  root.querySelectorAll('input, select, textarea').forEach((node, index) => {
    const field = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    const fieldId = `template-compare-docx-field-${index + 1}`
    if (!field.id) field.id = fieldId
    if (!field.name) field.name = fieldId
    field.setAttribute('aria-hidden', 'true')
    field.tabIndex = -1
    field.disabled = true
  })
}
