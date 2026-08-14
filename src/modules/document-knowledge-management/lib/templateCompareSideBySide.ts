import type { RevisionDiffSegment } from '@/lib/documents/revisionContentHighlight'

export type SideBySideChangeCard = {
  id: string
  index: number
  kind: 'REMOVED' | 'ADDED' | 'CHANGED'
  serverExcerpt: string | null
  uploadExcerpt: string | null
  ratio: number
}

export type MinimapMarker = {
  id: string
  ratio: number
  kind: 'removed' | 'added' | 'changed'
}

export function resolveChangeAnchorId(segments: RevisionDiffSegment[], index: number): string | null {
  const segment = segments[index]
  if (!segment || segment.type === 'equal') return null
  return `chg-${index}`
}

function excerpt(text: string, max = 80): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function classifyChange(
  segments: RevisionDiffSegment[],
  startIndex: number,
): { kind: SideBySideChangeCard['kind']; serverExcerpt: string | null; uploadExcerpt: string | null; endIndex: number } {
  let serverExcerpt: string | null = null
  let uploadExcerpt: string | null = null
  let i = startIndex
  while (i < segments.length && segments[i].type !== 'equal') {
    const seg = segments[i]
    if (seg.type === 'removed') serverExcerpt = excerpt(seg.text)
    if (seg.type === 'added') uploadExcerpt = excerpt(seg.text)
    i += 1
  }
  let kind: SideBySideChangeCard['kind'] = 'CHANGED'
  if (serverExcerpt && !uploadExcerpt) kind = 'REMOVED'
  else if (uploadExcerpt && !serverExcerpt) kind = 'ADDED'
  return { kind, serverExcerpt, uploadExcerpt, endIndex: i }
}

export function buildSideBySideChangeCards(segments: RevisionDiffSegment[]): SideBySideChangeCard[] {
  const cards: SideBySideChangeCard[] = []
  let changeIndex = 0
  let charOffset = 0
  const totalChars = Math.max(
    segments.reduce((sum, seg) => sum + seg.text.length, 0),
    1,
  )

  for (let i = 0; i < segments.length; i += 1) {
    charOffset += segments[i].text.length
    if (segments[i].type === 'equal') continue

    const { kind, serverExcerpt, uploadExcerpt, endIndex } = classifyChange(segments, i)
    changeIndex += 1
    const anchorId = resolveChangeAnchorId(segments, i)
    if (!anchorId) continue

    cards.push({
      id: anchorId,
      index: changeIndex,
      kind,
      serverExcerpt,
      uploadExcerpt,
      ratio: Math.min(0.98, Math.max(0.02, charOffset / totalChars)),
    })

    i = endIndex - 1
  }

  return cards
}

export function buildMinimapMarkers(cards: SideBySideChangeCard[]): MinimapMarker[] {
  return cards.map((card) => ({
    id: card.id,
    ratio: card.ratio,
    kind: card.kind === 'REMOVED' ? 'removed' : card.kind === 'ADDED' ? 'added' : 'changed',
  }))
}
