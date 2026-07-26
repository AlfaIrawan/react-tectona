/**
 * Lightweight revision text diff for highlighting changed content in Version lineage.
 * Line-first LCS, then word-level refine on changed lines — no external diff dependency.
 */

export type RevisionDiffSegment = {
  type: 'equal' | 'added' | 'removed'
  text: string
}

export type RevisionDiffResult = {
  segments: RevisionDiffSegment[]
  addedCount: number
  removedCount: number
  hasChanges: boolean
}

const MAX_CHARS = 120_000
const MAX_LINES = 4_000
const MAX_WORDS_PER_BLOCK = 800

function clampText(text: string): string {
  if (text.length <= MAX_CHARS) return text
  return `${text.slice(0, MAX_CHARS)}\n\n… [truncated for diff]`
}

function splitLines(text: string): string[] {
  const lines = clampText(text).replace(/\r\n/g, '\n').split('\n')
  if (lines.length <= MAX_LINES) return lines
  return [...lines.slice(0, MAX_LINES), '… [truncated for diff]']
}

function tokenizeWords(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [text]
}

/** Classic LCS DP on token arrays; returns index pairs kept from both sides. */
function lcsKeepMask(a: string[], b: string[]): { keepA: boolean[]; keepB: boolean[] } {
  const n = a.length
  const m = b.length
  // Space-optimized predecessor: store only previous row lengths + reconstruct via backtrack matrix of parents
  // For moderate n*m we store full table of small ints.
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 1; i <= n; i += 1) {
    const ai = a[i - 1]
    const row = dp[i]
    const prev = dp[i - 1]
    for (let j = 1; j <= m; j += 1) {
      if (ai === b[j - 1]) row[j] = (prev[j - 1] + 1) as number
      else row[j] = Math.max(prev[j], row[j - 1]) as number
    }
  }

  const keepA = Array.from({ length: n }, () => false)
  const keepB = Array.from({ length: m }, () => false)
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      keepA[i - 1] = true
      keepB[j - 1] = true
      i -= 1
      j -= 1
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1
    } else {
      j -= 1
    }
  }
  return { keepA, keepB }
}

function pushMerged(segments: RevisionDiffSegment[], type: RevisionDiffSegment['type'], text: string) {
  if (!text) return
  const last = segments[segments.length - 1]
  if (last && last.type === type) {
    last.text += text
    return
  }
  segments.push({ type, text })
}

function diffTokens(oldTokens: string[], newTokens: string[]): RevisionDiffSegment[] {
  if (oldTokens.length === 0 && newTokens.length === 0) return []
  if (oldTokens.length === 0) return [{ type: 'added', text: newTokens.join('') }]
  if (newTokens.length === 0) return [{ type: 'removed', text: oldTokens.join('') }]

  // Guard pathological sizes — fall back to whole-block replace.
  if (oldTokens.length * newTokens.length > 250_000) {
    return [
      { type: 'removed', text: oldTokens.join('') },
      { type: 'added', text: newTokens.join('') },
    ]
  }

  const { keepA, keepB } = lcsKeepMask(oldTokens, newTokens)
  const segments: RevisionDiffSegment[] = []
  let i = 0
  let j = 0
  while (i < oldTokens.length || j < newTokens.length) {
    if (i < oldTokens.length && !keepA[i]) {
      let chunk = ''
      while (i < oldTokens.length && !keepA[i]) {
        chunk += oldTokens[i]
        i += 1
      }
      pushMerged(segments, 'removed', chunk)
      continue
    }
    if (j < newTokens.length && !keepB[j]) {
      let chunk = ''
      while (j < newTokens.length && !keepB[j]) {
        chunk += newTokens[j]
        j += 1
      }
      pushMerged(segments, 'added', chunk)
      continue
    }
    if (i < oldTokens.length && j < newTokens.length && keepA[i] && keepB[j]) {
      let chunk = ''
      while (i < oldTokens.length && j < newTokens.length && keepA[i] && keepB[j] && oldTokens[i] === newTokens[j]) {
        chunk += newTokens[j]
        i += 1
        j += 1
      }
      pushMerged(segments, 'equal', chunk)
      continue
    }
    // Safety break for mismatched masks
    if (i < oldTokens.length) {
      pushMerged(segments, 'removed', oldTokens[i])
      i += 1
    } else if (j < newTokens.length) {
      pushMerged(segments, 'added', newTokens[j])
      j += 1
    }
  }
  return segments
}

function refineChangedLinePair(oldLine: string, newLine: string): RevisionDiffSegment[] {
  const oldWords = tokenizeWords(oldLine)
  const newWords = tokenizeWords(newLine)
  if (oldWords.length > MAX_WORDS_PER_BLOCK || newWords.length > MAX_WORDS_PER_BLOCK) {
    return [
      ...(oldLine ? [{ type: 'removed' as const, text: oldLine }] : []),
      ...(newLine ? [{ type: 'added' as const, text: newLine }] : []),
    ]
  }
  return diffTokens(oldWords, newWords)
}

/**
 * Diff previous revision text → current revision text.
 * Added/removed segments are what should be highlighted in the UI.
 */
export function buildRevisionContentDiff(previousText: string, currentText: string): RevisionDiffResult {
  const oldLines = splitLines(previousText ?? '')
  const newLines = splitLines(currentText ?? '')

  if (oldLines.join('\n') === newLines.join('\n')) {
    return {
      segments: currentText ? [{ type: 'equal', text: clampText(currentText) }] : [],
      addedCount: 0,
      removedCount: 0,
      hasChanges: false,
    }
  }

  // Cap LCS table size for line-level
  if (oldLines.length * newLines.length > 2_000_000) {
    const segments: RevisionDiffSegment[] = [
      { type: 'removed', text: oldLines.join('\n') },
      { type: 'added', text: newLines.join('\n') },
    ]
    return {
      segments,
      addedCount: 1,
      removedCount: 1,
      hasChanges: true,
    }
  }

  const { keepA, keepB } = lcsKeepMask(oldLines, newLines)
  const segments: RevisionDiffSegment[] = []
  let i = 0
  let j = 0

  while (i < oldLines.length || j < newLines.length) {
    const removing: string[] = []
    while (i < oldLines.length && !keepA[i]) {
      removing.push(oldLines[i])
      i += 1
    }
    const adding: string[] = []
    while (j < newLines.length && !keepB[j]) {
      adding.push(newLines[j])
      j += 1
    }

    if (removing.length || adding.length) {
      // Pair same-index lines for word refine when lengths match; otherwise block replace.
      if (removing.length === adding.length && removing.length > 0 && removing.length <= 40) {
        for (let k = 0; k < removing.length; k += 1) {
          const refined = refineChangedLinePair(removing[k], adding[k])
          for (const seg of refined) pushMerged(segments, seg.type, seg.text)
          if (k < removing.length - 1 || i < oldLines.length || j < newLines.length) {
            pushMerged(segments, 'equal', '\n')
          }
        }
      } else {
        if (removing.length) pushMerged(segments, 'removed', removing.join('\n'))
        if (removing.length && adding.length) pushMerged(segments, 'equal', '\n')
        if (adding.length) pushMerged(segments, 'added', adding.join('\n'))
        if (i < oldLines.length || j < newLines.length) pushMerged(segments, 'equal', '\n')
      }
      continue
    }

    if (i < oldLines.length && j < newLines.length && keepA[i] && keepB[j]) {
      const equalLines: string[] = []
      while (i < oldLines.length && j < newLines.length && keepA[i] && keepB[j] && oldLines[i] === newLines[j]) {
        equalLines.push(newLines[j])
        i += 1
        j += 1
      }
      pushMerged(segments, 'equal', equalLines.join('\n'))
      if (i < oldLines.length || j < newLines.length) pushMerged(segments, 'equal', '\n')
      continue
    }

    if (i < oldLines.length) {
      pushMerged(segments, 'removed', oldLines[i])
      i += 1
      if (i < oldLines.length || j < newLines.length) pushMerged(segments, 'equal', '\n')
    } else if (j < newLines.length) {
      pushMerged(segments, 'added', newLines[j])
      j += 1
      if (i < oldLines.length || j < newLines.length) pushMerged(segments, 'equal', '\n')
    }
  }

  let addedCount = 0
  let removedCount = 0
  for (const seg of segments) {
    if (seg.type === 'added' && seg.text.trim()) addedCount += 1
    if (seg.type === 'removed' && seg.text.trim()) removedCount += 1
  }

  return {
    segments,
    addedCount,
    removedCount,
    hasChanges: addedCount > 0 || removedCount > 0,
  }
}
