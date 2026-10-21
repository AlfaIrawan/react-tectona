import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, History, Loader2, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  getDocumentRevisionText,
  listDocumentRevisions,
  restoreDocumentRevision,
  type DocumentResponse,
  type DocumentRevision,
} from '@/lib/api/documentKnowledgeApi'
import { cn } from '@/lib/utils'

type TextPart = { text: string; changed: boolean }
type AlignedLine = {
  left?: string
  right?: string
  leftChanged: boolean
  rightChanged: boolean
  leftParts: TextPart[]
  rightParts: TextPart[]
}
const MAX_DIFF_LINES = 1_000
const MAX_TOKEN_CELLS = 50_000

function snapshotText(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter((part) => part.length > 0)
}

function mergeParts(parts: TextPart[]): TextPart[] {
  const merged: TextPart[] = []
  for (const part of parts) {
    const last = merged[merged.length - 1]
    if (last && last.changed === part.changed) last.text += part.text
    else merged.push({ text: part.text, changed: part.changed })
  }
  return merged
}

/** Word-level diff so a changed sentence highlights only the added and removed words. */
function diffTokens(left: string, right: string): { leftParts: TextPart[]; rightParts: TextPart[] } {
  if (left === right) {
    return {
      leftParts: left ? [{ text: left, changed: false }] : [],
      rightParts: right ? [{ text: right, changed: false }] : [],
    }
  }
  const older = tokenize(left)
  const newer = tokenize(right)
  if (older.length * newer.length > MAX_TOKEN_CELLS) {
    return {
      leftParts: [{ text: left, changed: true }],
      rightParts: [{ text: right, changed: true }],
    }
  }
  const width = newer.length + 1
  const matrix = new Uint16Array((older.length + 1) * width)
  for (let i = 1; i <= older.length; i += 1) {
    for (let j = 1; j <= newer.length; j += 1) {
      matrix[i * width + j] = older[i - 1] === newer[j - 1]
        ? matrix[(i - 1) * width + j - 1] + 1
        : Math.max(matrix[(i - 1) * width + j], matrix[i * width + j - 1])
    }
  }
  const leftRev: TextPart[] = []
  const rightRev: TextPart[] = []
  let i = older.length
  let j = newer.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && older[i - 1] === newer[j - 1]) {
      leftRev.push({ text: older[i - 1], changed: false })
      rightRev.push({ text: newer[j - 1], changed: false })
      i -= 1
      j -= 1
    } else if (j > 0 && (i === 0 || matrix[i * width + j - 1] >= matrix[(i - 1) * width + j])) {
      rightRev.push({ text: newer[j - 1], changed: true })
      j -= 1
    } else {
      leftRev.push({ text: older[i - 1], changed: true })
      i -= 1
    }
  }
  return { leftParts: mergeParts(leftRev.reverse()), rightParts: mergeParts(rightRev.reverse()) }
}

function lineParts(text: string | undefined, changed: boolean): TextPart[] {
  if (!text) return []
  return [{ text, changed }]
}

/** Sit a removed line beside the added line that replaced it, then highlight the words that differ. */
function pairChangedLines(lines: AlignedLine[]): AlignedLine[] {
  const paired: AlignedLine[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.leftChanged && !line.rightChanged) {
      paired.push(line)
      index += 1
      continue
    }
    const removed: AlignedLine[] = []
    const added: AlignedLine[] = []
    while (index < lines.length && (lines[index].leftChanged || lines[index].rightChanged)) {
      const changed = lines[index]
      if (changed.leftChanged && changed.left !== undefined) removed.push(changed)
      if (changed.rightChanged && changed.right !== undefined) added.push(changed)
      index += 1
    }
    const shared = Math.min(removed.length, added.length)
    for (let pair = 0; pair < shared; pair += 1) {
      const parts = diffTokens(removed[pair].left ?? '', added[pair].right ?? '')
      paired.push({
        left: removed[pair].left,
        right: added[pair].right,
        leftChanged: true,
        rightChanged: true,
        leftParts: parts.leftParts,
        rightParts: parts.rightParts,
      })
    }
    for (const row of removed.slice(shared)) paired.push(row)
    for (const row of added.slice(shared)) paired.push(row)
  }
  return paired
}

function alignLines(leftText: string, rightText: string): { lines: AlignedLine[]; truncated: boolean } {
  const allLeft = leftText.split('\n')
  const allRight = rightText.split('\n')
  const truncated = allLeft.length > MAX_DIFF_LINES || allRight.length > MAX_DIFF_LINES
  const left = allLeft.slice(0, MAX_DIFF_LINES)
  const right = allRight.slice(0, MAX_DIFF_LINES)
  const width = right.length + 1
  const matrix = new Uint16Array((left.length + 1) * width)

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      matrix[i * width + j] = left[i - 1] === right[j - 1]
        ? matrix[(i - 1) * width + j - 1] + 1
        : Math.max(matrix[(i - 1) * width + j], matrix[i * width + j - 1])
    }
  }

  const reversed: AlignedLine[] = []
  let i = left.length
  let j = right.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      reversed.push({
        left: left[i - 1],
        right: right[j - 1],
        leftChanged: false,
        rightChanged: false,
        leftParts: lineParts(left[i - 1], false),
        rightParts: lineParts(right[j - 1], false),
      })
      i -= 1
      j -= 1
    } else if (j > 0 && (i === 0 || matrix[i * width + j - 1] >= matrix[(i - 1) * width + j])) {
      reversed.push({
        right: right[j - 1],
        leftChanged: false,
        rightChanged: true,
        leftParts: [],
        rightParts: lineParts(right[j - 1], true),
      })
      j -= 1
    } else {
      reversed.push({
        left: left[i - 1],
        leftChanged: true,
        rightChanged: false,
        leftParts: lineParts(left[i - 1], true),
        rightParts: [],
      })
      i -= 1
    }
  }
  return { lines: pairChangedLines(reversed.reverse()), truncated }
}

type DiffRow = AlignedLine | { skipped: number }

/** Keep a little unchanged context around each edit, and collapse the rest the way a code diff does. */
function rowsWithContext(lines: AlignedLine[], context = 2): DiffRow[] {
  const rows: DiffRow[] = []
  let index = 0
  while (index < lines.length) {
    if (lines[index].leftChanged || lines[index].rightChanged) {
      rows.push(lines[index])
      index += 1
      continue
    }
    let end = index
    while (end < lines.length && !lines[end].leftChanged && !lines[end].rightChanged) end += 1
    const run = end - index
    if (run <= context * 2 + 1) {
      rows.push(...lines.slice(index, end))
    } else {
      rows.push(...lines.slice(index, index + context))
      rows.push({ skipped: run - context * 2 })
      rows.push(...lines.slice(end - context, end))
    }
    index = end
  }
  return rows
}

function isSkippedRow(row: DiffRow): row is { skipped: number } {
  return 'skipped' in row
}

function DiffSpans({ parts, tone }: { parts: TextPart[]; tone: 'remove' | 'add' }) {
  if (parts.length === 0) return null
  return (
    <>
      {parts.map((part, index) => (
        part.changed ? (
          <mark
            key={index}
            className={cn(
              'rounded-sm px-0.5',
              tone === 'remove' ? 'bg-red-200 text-red-950' : 'bg-emerald-200 text-emerald-950',
            )}
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      ))}
    </>
  )
}

export function IdeaDocumentHistory({ document, onClose, onRestored }: {
  document: DocumentResponse | null
  onClose: () => void
  onRestored: (document: DocumentResponse) => void
}) {
  const [rows, setRows] = useState<DocumentRevision[]>([])
  const [selectedVersions, setSelectedVersions] = useState<number[]>([])
  const [comparison, setComparison] = useState<{
    left: DocumentRevision
    right: DocumentRevision
    lines: AlignedLine[]
    truncated: boolean
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!document) return
    let cancelled = false
    setBusy(true)
    setError('')
    setRows([])
    setComparison(null)
    listDocumentRevisions(document.id)
      .then((items) => {
        if (cancelled) return
        setRows(items)
        setSelectedVersions(items.slice(0, 2).map((item) => item.version_no))
      })
      .catch((failure) => { if (!cancelled) setError(String(failure)) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [document])

  const selectedRows = useMemo(
    () => selectedVersions
      .map((versionNo) => rows.find((row) => row.version_no === versionNo))
      .filter((row): row is DocumentRevision => Boolean(row))
      .sort((a, b) => a.version_no - b.version_no),
    [rows, selectedVersions],
  )

  function toggleVersion(versionNo: number) {
    setComparison(null)
    setSelectedVersions((current) => {
      if (current.includes(versionNo)) return current.filter((value) => value !== versionNo)
      return current.length < 2 ? [...current, versionNo] : [current[1], versionNo]
    })
  }

  async function compareSelected() {
    if (selectedRows.length !== 2 || comparing) return
    setComparing(true)
    setError('')
    try {
      if (!document) return
      const [leftText, rightText] = await Promise.all(
        selectedRows.map((row) => getDocumentRevisionText(document.id, row)),
      )
      setComparison({
        left: selectedRows[0],
        right: selectedRows[1],
        ...alignLines(snapshotText(leftText), snapshotText(rightText)),
      })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not compare the selected versions.')
    } finally {
      setComparing(false)
    }
  }

  async function restore(row: DocumentRevision) {
    if (!document || busy) return
    setBusy(true)
    setError('')
    try {
      onRestored(await restoreDocumentRevision(document.id, {
        source_document_id: row.source_document_id,
        version_no: row.version_no,
        version: document.version,
      }))
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not restore that version.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(document)} onOpenChange={(open) => { if (!open && !busy && !comparing) onClose() }}>
      <DialogContent
        surface="solid"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-version-history-title"
        className={cn(
          'flex w-full flex-col gap-0 overflow-hidden p-0',
          'border border-border bg-gradient-to-b from-card via-card to-card/95',
          'shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]',
          comparison ? 'max-w-6xl' : 'max-w-lg',
        )}
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/25">
              <History className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id="document-version-history-title" className="text-base font-semibold tracking-tight text-foreground">
                Document version history
              </h3>
              <p className="text-sm text-muted-foreground">
                Select any two versions to compare their indexed content.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Document</p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{document?.title}</p>
          </div>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          {busy && rows.length === 0 ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" /> : null}
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background/70 px-4">
            {rows.map((row) => (
              <li key={`${row.source_document_id}:${row.version_no}`} className="flex items-center justify-between gap-3 py-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border"
                    checked={selectedVersions.includes(row.version_no)}
                    onChange={() => toggleVersion(row.version_no)}
                    aria-label={`Select version ${row.version_no} for comparison`}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold text-foreground">V{row.version_no}{row.is_current ? ' · Current' : ''}</span>
                    <span className="block text-xs text-muted-foreground">{new Date(row.created_date).toLocaleString('en-GB')}</span>
                    <span className="block break-words text-xs text-muted-foreground">{row.version_notes}</span>
                  </span>
                </label>
                {!row.is_current ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(enterpriseSecondaryButtonClass(), 'h-9 shrink-0 px-3')}
                    disabled={busy || comparing || !row.can_restore}
                    onClick={() => void restore(row)}
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                    Restore
                  </Button>
                ) : null}
              </li>
            ))}
            {!busy && !rows.length ? <li className="py-3 text-sm text-muted-foreground">No previous versions</li> : null}
          </ul>

          {comparison ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-red-200 ring-1 ring-red-300" aria-hidden />
                  Removed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-emerald-200 ring-1 ring-emerald-300" aria-hidden />
                  Added
                </span>
                <span className="ml-auto tabular-nums">
                  {comparison.lines.filter((line) => line.leftChanged && !line.rightChanged).length} removed
                  {' · '}
                  {comparison.lines.filter((line) => line.rightChanged && !line.leftChanged).length} added
                  {' · '}
                  {comparison.lines.filter((line) => line.leftChanged && line.rightChanged).length} changed
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl border border-border bg-border text-xs font-semibold">
                <div className="bg-muted px-3 py-2">V{comparison.left.version_no}</div>
                <div className="bg-muted px-3 py-2">V{comparison.right.version_no}</div>
              </div>
              <div className="max-h-[46vh] overflow-auto rounded-b-xl border border-border font-mono text-[11px] leading-5">
                {comparison.lines.every((line) => !line.leftChanged && !line.rightChanged) ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">No additions or removals in the indexed text of these two versions.</p>
                ) : rowsWithContext(comparison.lines).map((row, index) => (
                  isSkippedRow(row) ? (
                    <div key={`skip-${index}`} className="border-b border-border/40 bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-500">
                      {row.skipped} unchanged lines
                    </div>
                  ) : (
                    <div key={`${index}:${row.left ?? ''}:${row.right ?? ''}`} className="grid min-w-[900px] grid-cols-2 border-b border-border/40 last:border-b-0">
                      <div className={cn('flex min-h-5 gap-1.5 px-2 py-0.5', row.leftChanged && 'bg-red-50')}>
                        <span className="w-3 shrink-0 select-none font-semibold text-red-700" aria-hidden>{row.leftChanged ? '−' : ''}</span>
                        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-800">
                          <DiffSpans parts={row.leftParts} tone="remove" />
                        </div>
                      </div>
                      <div className={cn('flex min-h-5 gap-1.5 border-l border-border/50 px-2 py-0.5', row.rightChanged && 'bg-emerald-50')}>
                        <span className="w-3 shrink-0 select-none font-semibold text-emerald-700" aria-hidden>{row.rightChanged ? '+' : ''}</span>
                        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-800">
                          <DiffSpans parts={row.rightParts} tone="add" />
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
              {comparison.truncated ? <p className="text-xs text-amber-700">Comparison is limited to the first {MAX_DIFF_LINES.toLocaleString()} lines per version.</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            disabled={busy || comparing}
            onClick={onClose}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            disabled={selectedRows.length !== 2 || busy || comparing}
            onClick={() => void compareSelected()}
          >
            {comparing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />}
            Compare selected
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
