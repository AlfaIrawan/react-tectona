import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Check, Loader2, PencilLine, RefreshCcw, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  listDiagramAiDraftAudit,
  listDiagramVersions,
  type DiagramAiDraftAuditApi,
  type DiagramVersionApi,
} from '@/lib/api/ideaBacklogApi'
import type { C4ArchitectureReviewAuditEntry } from '@/modules/project-management/lib/c4ArchitectureService'
import { chatAuditDraftSummary } from '@/modules/project-management/lib/diagramChatDraft'

/**
 * One history for a diagram ("Riwayat"): its versions (made by AI, edited, changed through Ask
 * Gen AI, restored), the Ask Gen AI drafts that changed nothing, and the architecture review
 * steps. A version other than the current one can be restored.
 */

type Entry =
  | { kind: 'version'; at: string; version: DiagramVersionApi; previous?: DiagramVersionApi }
  | { kind: 'draft'; at: string; audit: DiagramAiDraftAuditApi }
  | { kind: 'review'; at: string; review: C4ArchitectureReviewAuditEntry }

const VERSION_LABELS: Record<string, string> = {
  initial: 'Versi awal',
  ai_generated: 'Dibuat AI',
  manual_edit: 'Diedit',
  ai_chat: 'Diubah lewat Ask Gen AI',
  restored: 'Dipulihkan',
  review: 'Review',
  system: 'Diperbarui sistem',
}
const DRAFT_LABELS: Record<DiagramAiDraftAuditApi['action'], string> = {
  requested: 'Draft AI diusulkan',
  applied: 'Draft AI diterapkan',
  discarded: 'Draft AI dibatalkan',
  undone: 'Draft AI di-undo',
}
const REVIEW_LABELS: Record<string, string> = {
  submitted: 'Diajukan untuk review',
  approved: 'Disetujui',
  revision_requested: 'Diminta revisi',
  rejected: 'Ditolak',
  cancelled: 'Review dibatalkan',
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function elementName(element: string): string {
  return element.replace(/\s*<<[^>]*>>\s*$/, '')
}

function changeSummary(version: DiagramVersionApi, previous?: DiagramVersionApi): string | null {
  const now = version.summary.elements ?? []
  if (!previous) return null
  const before = previous.summary.elements ?? []
  const added = now.filter((item) => !before.includes(item)).map(elementName)
  const removed = before.filter((item) => !now.includes(item)).map(elementName)
  const parts = [
    added.length ? `+ ${added.slice(0, 4).join(', ')}${added.length > 4 ? ` (+${added.length - 4})` : ''}` : '',
    removed.length ? `− ${removed.slice(0, 4).join(', ')}${removed.length > 4 ? ` (+${removed.length - 4})` : ''}` : '',
  ].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  const relationDelta = (version.summary.relation_count ?? 0) - (previous.summary.relation_count ?? 0)
  if (relationDelta) return `${relationDelta > 0 ? '+' : '−'} ${Math.abs(relationDelta)} relasi`
  return 'Relasi atau label diubah'
}

function EntryIcon({ entry }: { entry: Entry }) {
  const className = 'h-4 w-4'
  if (entry.kind === 'review') return <ShieldCheck className={className} />
  if (entry.kind === 'draft') return <Bot className={className} />
  const source = entry.version.change_source
  if (source === 'ai_generated' || source === 'ai_chat') return <Sparkles className={className} />
  if (source === 'restored') return <RotateCcw className={className} />
  if (source === 'review') return <ShieldCheck className={className} />
  return <PencilLine className={className} />
}

export function DiagramHistoryDialog({
  open,
  onOpenChange,
  ideaId,
  diagramKey,
  title,
  reviewHistory,
  resolveName,
  onRestore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ideaId: string
  diagramKey: string
  title: string
  reviewHistory: C4ArchitectureReviewAuditEntry[]
  resolveName: (subjectOrName: string) => string
  onRestore: (versionNo: number) => Promise<void>
}) {
  const [versions, setVersions] = useState<DiagramVersionApi[]>([])
  const [drafts, setDrafts] = useState<DiagramAiDraftAuditApi[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null)
  const [restoring, setRestoring] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextVersions, nextDrafts] = await Promise.all([
        listDiagramVersions(ideaId, diagramKey),
        listDiagramAiDraftAudit(ideaId, diagramKey).catch(() => [] as DiagramAiDraftAuditApi[]),
      ])
      setVersions(nextVersions)
      setDrafts(nextDrafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat tidak bisa dimuat.')
    } finally {
      setLoading(false)
    }
  }, [diagramKey, ideaId])

  useEffect(() => {
    if (!open) return
    setConfirmVersion(null)
    void load()
  }, [load, open])

  const entries = useMemo(() => {
    const byNumber = [...versions].sort((a, b) => a.version_no - b.version_no)
    const firstVersionAt = byNumber[0]?.created_at
    const list: Entry[] = byNumber.map((version, index) => ({ kind: 'version', at: version.created_at, version, previous: byNumber[index - 1] }))
    for (const audit of drafts) {
      // Applied and undone drafts are versions ("Diubah lewat Ask Gen AI"); those from before
      // versions were kept are shown as events.
      if ((audit.action === 'applied' || audit.action === 'undone') && firstVersionAt && Date.parse(audit.created_at) >= Date.parse(firstVersionAt)) continue
      list.push({ kind: 'draft', at: audit.created_at, audit })
    }
    for (const review of reviewHistory) {
      if (review.action !== 'diagram_changed') list.push({ kind: 'review', at: review.at, review })
    }
    return list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  }, [drafts, reviewHistory, versions])
  const currentVersionNo = versions.reduce((max, version) => Math.max(max, version.version_no), 0)

  const restore = async (versionNo: number) => {
    setRestoring(versionNo)
    setError(null)
    try {
      await onRestore(versionNo)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versi tidak bisa dipulihkan.')
    } finally {
      setRestoring(null)
      setConfirmVersion(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="solid" className="flex w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base">Riwayat {title}</DialogTitle>
          <DialogDescription>Versi diagram, perubahan lewat Ask Gen AI, dan langkah review. Versi lama bisa dipulihkan.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat...</p> : null}
          {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
          {!loading && entries.length === 0 ? <p className="text-sm text-slate-500">Belum ada riwayat. Versi tercatat mulai perubahan berikutnya.</p> : null}
          <ol className="space-y-2">
            {entries.map((entry) => {
              const key = entry.kind === 'version' ? `v-${entry.version.id}` : entry.kind === 'draft' ? `d-${entry.audit.id}` : `r-${entry.review.id}`
              const isCurrent = entry.kind === 'version' && entry.version.version_no === currentVersionNo
              return (
                <li key={key} className={`rounded-lg border bg-white p-3 ${isCurrent ? 'border-sky-300' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 rounded-md p-1.5 ${entry.kind === 'version' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'}`}><EntryIcon entry={entry} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-sm font-semibold text-slate-800">
                          {entry.kind === 'version'
                            ? `v${entry.version.version_no} · ${VERSION_LABELS[entry.version.change_source] ?? entry.version.change_source}`
                            : entry.kind === 'draft'
                              ? DRAFT_LABELS[entry.audit.action]
                              : REVIEW_LABELS[entry.review.action] ?? entry.review.action}
                        </p>
                        {isCurrent ? <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Versi saat ini</span> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {entry.kind === 'version' ? resolveName(entry.version.actor_id) : entry.kind === 'draft' ? resolveName(entry.audit.actor_id) : entry.review.actorName}
                        {' · '}
                        {formatTime(entry.at)}
                        {entry.kind === 'version' && entry.version.change_source === 'manual_edit' && Date.parse(entry.version.updated_at) - Date.parse(entry.version.created_at) > 60_000
                          ? ` – ${new Date(entry.version.updated_at).toLocaleTimeString('id-ID', { timeStyle: 'short' })}`
                          : ''}
                      </p>
                      {entry.kind === 'version' ? (
                        <>
                          {entry.version.change_note ? <p className="mt-1 text-sm text-slate-700">{entry.version.change_note}</p> : null}
                          <p className="mt-1 text-xs text-slate-500">
                            {(entry.version.summary.elements ?? []).length} elemen, {entry.version.summary.relation_count ?? 0} relasi
                            {changeSummary(entry.version, entry.previous) ? ` · ${changeSummary(entry.version, entry.previous)}` : ''}
                          </p>
                        </>
                      ) : null}
                      {entry.kind === 'draft' && chatAuditDraftSummary(entry.audit.draft_json) ? (
                        <p className="mt-1 text-sm text-slate-700">{chatAuditDraftSummary(entry.audit.draft_json)}</p>
                      ) : null}
                      {entry.kind === 'review' && entry.review.comment ? <p className="mt-1 text-sm text-slate-700">{entry.review.comment}</p> : null}
                    </div>
                    {entry.kind === 'version' && !isCurrent ? (
                      confirmVersion === entry.version.version_no ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button type="button" size="sm" className="h-7 gap-1 text-xs" disabled={restoring !== null} onClick={() => void restore(entry.version.version_no)}>
                            {restoring === entry.version.version_no ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Pulihkan
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="Batal" disabled={restoring !== null} onClick={() => setConfirmVersion(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" disabled={restoring !== null} onClick={() => setConfirmVersion(entry.version.version_no)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Pulihkan
                        </Button>
                      )
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
        <DialogFooter className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 sm:justify-between">
          <Button type="button" variant="outline" className="gap-1.5" disabled={loading} onClick={() => void load()}>
            <RefreshCcw className="h-4 w-4" /> Muat ulang
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
