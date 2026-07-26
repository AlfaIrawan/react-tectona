import type { TectonaUiContextPayload } from '@/lib/chat/tectonaChatUiContext'

export function normalizeEvidenceText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pull focus terms only from the user's message (no fixed domain vocabulary). */
export function extractUserMessageFocusTerms(text: string): string[] {
  const normalized = normalizeEvidenceText(text)
  const terms = new Set<string>()
  const stopWords = new Set([
    'jelaskan',
    'jelasin',
    'status',
    'arti',
    'maksud',
    'pengertian',
    'tolong',
    'donk',
    'dong',
    'bisa',
    'what',
    'is',
    'the',
    'dan',
    'atau',
    'yang',
    'ini',
    'itu',
    'untuk',
    'dari',
    'pada',
    'dengan',
    'adalah',
    'apa',
  ])

  const explainPhrase = normalized.match(
    /(?:arti|maksud|pengertian|jelaskan|jelasin|explain|what\s+is)\s+(?:status\s+)?(.+?)(?:\?|$)/,
  )
  if (explainPhrase?.[1]) {
    const phrase = explainPhrase[1].trim().replace(/[?.!]+$/, '')
    if (phrase.length >= 3 && phrase.length <= 56) terms.add(phrase)
  }

  const statusPhrase = normalized.match(/\bstatus\s+([a-z0-9\s-]{2,48})/)
  if (statusPhrase?.[1]) terms.add(statusPhrase[1].trim())

  const quoted = normalized.match(/"([^"]{3,60})"|'([^']{3,60})'/g) ?? []
  for (const raw of quoted) {
    const cleaned = normalizeEvidenceText(raw.replace(/^['"]|['"]$/g, ''))
    if (cleaned.length >= 3) terms.add(cleaned)
  }

  for (const token of normalized.split(/[^a-z0-9]+/)) {
    if (token.length < 3 || token.length > 48 || stopWords.has(token)) continue
    terms.add(token)
  }

  const bigrams: string[] = []
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2 && !stopWords.has(w))
  for (let i = 0; i < words.length - 1; i += 1) {
    const phrase = `${words[i]} ${words[i + 1]}`.trim()
    if (phrase.length >= 5 && phrase.length <= 56) bigrams.push(phrase)
  }
  for (const phrase of bigrams) terms.add(phrase)

  return [...terms]
    .filter((c) => c.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8)
}

export function buildEvidenceFocusCandidates(
  text: string,
  ui: TectonaUiContextPayload | null,
): string[] {
  const userTerms = extractUserMessageFocusTerms(text)
  const candidates = new Set<string>(userTerms)

  if (userTerms.length === 0) {
    const viewLabel = normalizeEvidenceText(ui?.view_label)
    const pageTitle = normalizeEvidenceText(ui?.page_title)
    if (viewLabel) candidates.add(viewLabel)
    if (pageTitle) candidates.add(pageTitle)
  }

  return [...candidates].filter((c) => c.length >= 3).slice(0, 8)
}

export function isVisibleEvidenceElement(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width < 40 || rect.height < 20) return false
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0
}

export function resolveEvidenceCaptureRoot(): HTMLElement {
  return (
    document.querySelector<HTMLElement>('[data-chat-evidence-root]') ??
    document.querySelector<HTMLElement>('main')?.parentElement ??
    document.querySelector<HTMLElement>('main') ??
    document.body
  )
}

export type EvidenceCapturePlan =
  | { kind: 'element'; target: HTMLElement; focused: boolean }
  | {
      kind: 'union'
      root: HTMLElement
      clip: { x: number; y: number; width: number; height: number }
      focused: boolean
      matchCount: number
    }

function isPageChromeLabel(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag !== 'h1' && tag !== 'h2') return false
  const rect = el.getBoundingClientRect()
  return rect.top < 220
}

function resolveEvidenceContainer(label: HTMLElement): HTMLElement {
  const region = label.closest<HTMLElement>('[data-chat-evidence-region]')
  if (region) return region

  return (
    label.closest<HTMLElement>('[class*="card"]') ??
    label.closest<HTMLElement>('button,[role="button"]') ??
    label.closest<HTMLElement>('table,tbody,tr,[role="row"],[role="gridcell"]') ??
    label.closest<HTMLElement>('section,article,[role="region"],[class*="panel"],[class*="summary"]') ??
    label.closest<HTMLElement>('div') ??
    label
  )
}

function describeSurfaceKind(container: HTMLElement): string {
  const region = container.getAttribute('data-chat-evidence-region')
  if (region) return region
  if (container.closest('button,[role="button"]')) return 'button'
  if (container.closest('[class*="card"]')) return 'card'
  if (container.closest('table,tbody,tr,[role="row"]')) return 'table'
  if (container.closest('[role="tab"],[role="tablist"]')) return 'tab'
  return container.tagName.toLowerCase() || 'element'
}

function summarizeContainerLabel(container: HTMLElement): string {
  const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return '(tanpa teks)'
  return text.length > 72 ? `${text.slice(0, 69)}…` : text
}

/** Live DOM scan: factual UI observations only (Agent interprets — no imperative copy). */
export function buildDynamicUiSurfaceNotes(focusText: string): string[] {
  const candidates = buildEvidenceFocusCandidates(focusText, null)
  if (candidates.length === 0) return []

  const root = resolveEvidenceCaptureRoot()
  const matches = collectEvidenceMatches(root, candidates)
  if (matches.length === 0) return []

  const notes: string[] = []
  const seen = new Set<string>()
  for (const { container } of matches.slice(0, 6)) {
    const surface = describeSurfaceKind(container)
    const label = summarizeContainerLabel(container)
    const note = `ui_label_match: surface=${surface}, text="${label}"`
    if (seen.has(note)) continue
    seen.add(note)
    notes.push(note)
  }

  if (matches.length >= 2) {
    notes.push(`ui_label_match_count: ${matches.length}`)
  }

  return notes.slice(0, 6)
}

type ScoredMatch = { container: HTMLElement; score: number }

function collectEvidenceMatches(root: HTMLElement, candidates: string[]): ScoredMatch[] {
  const labels = Array.from(
    root.querySelectorAll<HTMLElement>(
      'h1,h2,h3,h4,h5,[role="heading"],p,span,label,th,td,dt,dd,a,button,div',
    ),
  )
  const viewportArea = Math.max(window.innerWidth * window.innerHeight, 1)
  const byContainer = new Map<HTMLElement, number>()

  for (const label of labels) {
    if (!isVisibleEvidenceElement(label)) continue
    const text = normalizeEvidenceText(label.textContent)
    if (!text || text.length > 120) continue

    const matched = candidates.filter((c) => text.includes(c) || c.includes(text))
    if (matched.length === 0) continue

    const container = resolveEvidenceContainer(label)
    if (!isVisibleEvidenceElement(container)) continue

    const rect = container.getBoundingClientRect()
    const area = rect.width * rect.height
    if (area < 80 * 36) continue

    const sizePenalty = Math.min(area / viewportArea, 1)
    const distancePenalty = Math.min((Math.abs(rect.top) + Math.abs(rect.left)) / 2000, 1)
    let score = sizePenalty + distancePenalty

    const inCard = Boolean(label.closest('[class*="card"]'))
    const inFilterButton = label.closest('button,[role="button"]') !== null
    const inTable = Boolean(label.closest('table,tbody,tr'))
    const chrome = isPageChromeLabel(label)
    const shortLabelMatch = matched.some((c) => c.length <= 24 && text.length <= 48)

    if (inCard || inTable || inFilterButton) score -= 0.8
    if (shortLabelMatch) score -= 0.5
    if (chrome && !inCard) score += 1.5

    const prev = byContainer.get(container)
    if (prev === undefined || score < prev) {
      byContainer.set(container, score)
    }
  }

  return [...byContainer.entries()]
    .map(([container, score]) => ({ container, score }))
    .sort((a, b) => a.score - b.score)
}

function inflateDomRect(rect: DOMRect, padding: number): DOMRect {
  return new DOMRect(
    rect.x - padding,
    rect.y - padding,
    rect.width + padding * 2,
    rect.height + padding * 2,
  )
}

function mergeClientRects(rects: DOMRect[]): DOMRect {
  const top = Math.min(...rects.map((r) => r.top))
  const left = Math.min(...rects.map((r) => r.left))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

function buildUnionClip(root: HTMLElement, containers: HTMLElement[]): EvidenceCapturePlan | null {
  const rects = containers
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
  if (rects.length < 2) return null

  const rootRect = root.getBoundingClientRect()
  const union = inflateDomRect(mergeClientRects(rects), 20)
  const x = Math.max(0, union.left - rootRect.left + root.scrollLeft)
  const y = Math.max(0, union.top - rootRect.top + root.scrollTop)
  const width = Math.min(root.scrollWidth - x, union.width)
  const height = Math.min(root.scrollHeight - y, union.height)
  if (width < 120 || height < 80) return null

  return {
    kind: 'union',
    root,
    clip: { x, y, width, height },
    focused: true,
    matchCount: containers.length,
  }
}

export function resolveEvidenceCapturePlan(
  root: HTMLElement,
  candidates: string[],
): EvidenceCapturePlan {
  if (candidates.length === 0) {
    return { kind: 'element', target: root, focused: false }
  }

  const matches = collectEvidenceMatches(root, candidates)
  if (matches.length === 0) {
    return { kind: 'element', target: root, focused: false }
  }

  if (matches.length >= 2) {
    const unionPlan = buildUnionClip(
      root,
      matches.slice(0, 4).map((m) => m.container),
    )
    if (unionPlan) return unionPlan
  }

  return {
    kind: 'element',
    target: matches[0].container,
    focused: matches[0].container !== root,
  }
}

/** @deprecated Use resolveEvidenceCapturePlan — kept for tests/callers expecting single element. */
export function findFocusedEvidenceCaptureTarget(
  root: HTMLElement,
  candidates: string[],
): { target: HTMLElement; focused: boolean } {
  const plan = resolveEvidenceCapturePlan(root, candidates)
  if (plan.kind === 'union') {
    return { target: plan.root, focused: plan.focused }
  }
  return { target: plan.target, focused: plan.focused }
}

export type Html2CanvasClip = { x: number; y: number; width: number; height: number }

export function html2CanvasOptionsForPlan(
  plan: EvidenceCapturePlan,
  scale: number,
): { target: HTMLElement; options: Record<string, unknown> } {
  if (plan.kind === 'union') {
    return {
      target: plan.root,
      options: {
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        scale,
        x: plan.clip.x,
        y: plan.clip.y,
        width: plan.clip.width,
        height: plan.clip.height,
      },
    }
  }

  return {
    target: plan.target,
    options: {
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      scale,
    },
  }
}
