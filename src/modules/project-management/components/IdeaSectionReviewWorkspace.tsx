import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Bot, Check, Clock3, History, Loader2, LockKeyhole, PencilLine, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  createIdeaSectionRevision,
  getActiveIdeaSectionRevision,
  getIdeaById,
  listIdeaSectionRevisions,
  transitionIdeaSectionRevision,
  type IdeaSectionRevisionApi,
} from '@/lib/api/ideaBacklogApi'
import { IDEA_SECTION_REVISION_UPDATED_EVENT } from '@/lib/chat/ideaSectionRevisionFromChat'
import { requestOpenIdeaDiscussChat } from '@/stores/chat-navigation-store'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { normalizeLegacyStructuredReviewContent } from '@/modules/project-management/lib/ideaSectionReviewContent'
import type { IdeaPanelKey } from '@/modules/project-management/lib/ideaPanelCatalog'

type ReviewStatus = 'ai_draft' | 'in_review' | 'approved'
type RevisionSource = 'human' | 'ai'

type RevisionVersion = {
  id: string
  content: string
  source: RevisionSource
  status: 'proposed' | 'accepted' | 'rejected' | 'approved' | 'superseded'
  author: string
  createdAt: string
}

type SectionReviewRecord = {
  status: ReviewStatus
  activeContent: string
  activeRevisionId: string | null
  versions: RevisionVersion[]
  updatedAt: string | null
}

const EMPTY_RECORD: SectionReviewRecord = {
  status: 'ai_draft',
  activeContent: '',
  activeRevisionId: null,
  versions: [],
  updatedAt: null,
}

function revisionText(revision: IdeaSectionRevisionApi | null | undefined) {
  const value = revision?.content_json?.text
  return typeof value === 'string' ? value : ''
}

function reviewRecordFromApi(
  revisions: IdeaSectionRevisionApi[],
  activeRevision: IdeaSectionRevisionApi | null,
): SectionReviewRecord {
  return {
    status: activeRevision?.status === 'approved'
      ? 'approved'
      : activeRevision?.status === 'accepted'
        ? 'in_review'
        : 'ai_draft',
    activeContent: revisionText(activeRevision),
    activeRevisionId: activeRevision?.id ?? null,
    versions: revisions.map((revision) => ({
      id: revision.id,
      content: revisionText(revision),
      source: revision.source,
      status: revision.status,
      author: revision.approved_by || revision.author_id,
      createdAt: revision.updated_date || revision.created_date,
    })),
    updatedAt: activeRevision?.updated_date
      || activeRevision?.created_date
      || revisions[0]?.updated_date
      || revisions[0]?.created_date
      || null,
  }
}

function statusMeta(status: ReviewStatus) {
  if (status === 'approved') {
    return { label: 'Approved', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  if (status === 'in_review') {
    return { label: 'In review', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  return { label: 'AI draft', className: 'border-sky-200 bg-sky-50 text-sky-700' }
}

type ImpactScoreReference = {
  businessValue: string
  effort: string
  risk: string
  roi: string
}

const PROTECTED_IMPACT_SCORE_LINE = /^\s*(business\s+value|effort|risk|roi)\s*:/im

function impactReferenceValue(content: string, label: string) {
  const match = content.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, 'im'))
  return match?.[1]?.trim() || 'Not scored'
}

function parseImpactScoreReference(content: string): ImpactScoreReference {
  return {
    businessValue: impactReferenceValue(content, 'Business\\s+value'),
    effort: impactReferenceValue(content, 'Effort'),
    risk: impactReferenceValue(content, 'Risk'),
    roi: impactReferenceValue(content, 'ROI'),
  }
}

function stripImpactScoreFields(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => !/^\s*(idea|business\s+value|effort|risk|roi)\s*:/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildImpactNarrativeDraft(content: string) {
  const businessObjective = content.match(/^\s*Business objective\s*:\s*(.+?)\s*$/im)?.[1]?.trim() || ''
  const riskSummary = content.match(/^\s*Risk summary\s*:\s*(.+?)\s*$/im)?.[1]?.trim() || ''

  return [
    `Expected impact: ${businessObjective}`,
    'Affected stakeholders:',
    'Assumptions:',
    `Risks and dependencies: ${riskSummary}`,
    'Supporting evidence:',
  ].join('\n\n')
}

type IdeaSectionReviewWorkspaceProps = {
  ideaId: string
  ideaTitle: string
  ideaDescription: string
  workspaceId?: string | null
  userId?: string | null
  userName?: string | null
  sectionKey: IdeaPanelKey
  sectionLabel: string
  currentContent: string
  ideaVersion?: number
}

export function IdeaSectionReviewWorkspace({
  ideaId,
  ideaTitle,
  ideaDescription,
  workspaceId,
  userId,
  sectionKey,
  sectionLabel,
  currentContent,
  ideaVersion,
}: IdeaSectionReviewWorkspaceProps) {
  const [record, setRecord] = useState<SectionReviewRecord>(EMPTY_RECORD)
  const [recordLoading, setRecordLoading] = useState(true)
  const [recordBusy, setRecordBusy] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const meta = statusMeta(record.status)
  const availableContent = useMemo(
    () => normalizeLegacyStructuredReviewContent(
      sectionKey,
      record.activeContent.trim() || currentContent.trim(),
    ),
    [currentContent, record.activeContent, sectionKey],
  )
  const sourceContent = availableContent || 'No section analysis is available yet.'
  const isImpactSection = sectionKey === 'impact'
  const usesCodeFormatting = sectionKey === 'process'
  const impactScoreReference = useMemo(
    () => parseImpactScoreReference(currentContent),
    [currentContent],
  )

  const refreshRecord = useCallback(async () => {
    const [revisions, activeRevision] = await Promise.all([
      listIdeaSectionRevisions(ideaId, sectionKey),
      getActiveIdeaSectionRevision(ideaId, sectionKey),
    ])
    setRecord(reviewRecordFromApi(revisions, activeRevision))
  }, [ideaId, sectionKey])

  useEffect(() => {
    let active = true
    setRecordLoading(true)
    setRecordError(null)
    Promise.all([
      listIdeaSectionRevisions(ideaId, sectionKey),
      getActiveIdeaSectionRevision(ideaId, sectionKey),
    ])
      .then(([revisions, activeRevision]) => {
        if (active) setRecord(reviewRecordFromApi(revisions, activeRevision))
      })
      .catch((error) => {
        if (active) {
          setRecord(EMPTY_RECORD)
          setRecordError(error instanceof Error ? error.message : 'Section revision history could not be loaded.')
        }
      })
      .finally(() => {
        if (active) setRecordLoading(false)
      })
    return () => {
      active = false
    }
  }, [ideaId, sectionKey])

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ ideaId?: string; sectionKey?: string }>).detail
      if (detail?.ideaId !== ideaId || detail?.sectionKey !== sectionKey) return
      void refreshRecord().catch(() => undefined)
    }
    window.addEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdated)
  }, [ideaId, sectionKey, refreshRecord])

  const createAndTransitionRevision = async (
    content: string,
    source: RevisionSource,
    transition: 'accept' | 'reject' | 'approve',
    metadata?: {
      confidenceScore?: number | null
      evidence?: Array<Record<string, unknown>>
      sourceSessionId?: string | null
    },
  ) => {
    const body = {
      content_json: { text: content },
      source,
      ...(ideaVersion ? { base_idea_version: ideaVersion } : {}),
      confidence_score: metadata?.confidenceScore,
      evidence_json: metadata?.evidence ?? [],
      source_session_id: metadata?.sourceSessionId,
    }
    let created: IdeaSectionRevisionApi
    try {
      created = await createIdeaSectionRevision(ideaId, sectionKey, body)
    } catch (error) {
      if (!ideaVersion || !(error instanceof Error) || !/version conflict/i.test(error.message)) throw error
      const latestIdea = await getIdeaById(ideaId)
      created = await createIdeaSectionRevision(ideaId, sectionKey, {
        ...body,
        base_idea_version: latestIdea.version,
      })
    }
    await transitionIdeaSectionRevision(ideaId, sectionKey, created.id, transition)
    await refreshRecord()
  }

  const openEditor = () => {
    setEditError(null)
    if (isImpactSection) {
      const existingNarrative = record.activeContent.trim()
        ? stripImpactScoreFields(record.activeContent)
        : ''
      setEditValue(existingNarrative || buildImpactNarrativeDraft(currentContent))
    } else {
      setEditValue(sourceContent)
    }
    setEditOpen(true)
  }

  const saveManualRevision = async () => {
    const content = editValue.trim()
    if (!content) return
    if (isImpactSection && PROTECTED_IMPACT_SCORE_LINE.test(content)) {
      setEditError('Official scoring values cannot be changed in an Impact narrative. Request a score reassessment from the Scoring section.')
      return
    }
    setRecordBusy(true)
    setRecordError(null)
    try {
      await createAndTransitionRevision(content, 'human', 'accept')
      setEditOpen(false)
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'The revision could not be saved.')
    } finally {
      setRecordBusy(false)
    }
  }

  const openAiReview = () => {
    requestOpenIdeaDiscussChat({
      ideaId,
      ideaTitle,
      sectionKey,
      sectionLabel,
      ideaDescription,
      currentSectionContent: sourceContent,
      workspaceId,
      userId,
      isImpactSection,
    })
  }

  const approveRevision = async () => {
    const content = availableContent.trim()
    if (!content) return
    setRecordBusy(true)
    setRecordError(null)
    try {
      if (record.activeRevisionId) {
        await transitionIdeaSectionRevision(ideaId, sectionKey, record.activeRevisionId, 'approve')
        await refreshRecord()
      } else {
        await createAndTransitionRevision(content, 'ai', 'approve')
      }
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'The revision could not be approved.')
    } finally {
      setRecordBusy(false)
    }
  }

  return (
    <>
      <div className="flex min-w-0 shrink-0 items-center gap-1 rounded-lg border border-slate-200/80 bg-white/55 p-0.5 shadow-sm backdrop-blur-md">
        <Badge
          variant="outline"
          className={cn('h-6 shrink-0 px-2 text-[10px] font-semibold', meta.className)}
          title={record.updatedAt ? `Last reviewed ${new Date(record.updatedAt).toLocaleString()}` : 'AI output requires human review'}
        >
          {recordLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          {meta.label}
        </Badge>
        <span className="hidden max-w-40 truncate px-1 text-[10px] text-muted-foreground xl:inline">
          {recordLoading
            ? 'Loading revision history...'
            : record.updatedAt
              ? `Reviewed ${new Date(record.updatedAt).toLocaleDateString()}`
              : 'AI output requires human review'}
        </span>
        {recordError ? (
          <span
            className="inline-flex h-6 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-700"
            title={recordError}
          >
            <AlertCircle className="h-3 w-3" /> Error
          </span>
        ) : null}
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-[11px]" onClick={openEditor} disabled={recordLoading || recordBusy}>
          <PencilLine className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-[11px]"
          title="Open Chat panel and continue this idea with Tectona Assistant"
          onClick={openAiReview}
          disabled={recordLoading || recordBusy}
        >
          <Bot className="h-3.5 w-3.5" /> Discuss with AI
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Version history" onClick={() => setHistoryOpen(true)} disabled={recordLoading || recordBusy}>
          <History className="h-3.5 w-3.5" />
        </Button>
        {record.status !== 'approved' ? (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-1.5 text-[11px]" onClick={() => void approveRevision()} disabled={recordLoading || recordBusy || !availableContent}>
            {recordBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
          </Button>
        ) : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 p-0 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]">
          <DialogHeader className="mb-0 border-b border-border/70 bg-muted/25 px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
                <PencilLine className="h-5 w-5" aria-hidden />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-semibold tracking-tight">Edit {sectionLabel}</DialogTitle>
                <DialogDescription className="text-sm">
                  Create a human revision while preserving the original AI evidence and audit history.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 px-6 py-5">
            {isImpactSection ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4 text-slate-500" aria-hidden />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Official scoring reference
                    </p>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600">
                    Read-only
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  {([
                    ['Business value', impactScoreReference.businessValue],
                    ['Effort', impactScoreReference.effort],
                    ['Risk', impactScoreReference.risk],
                    ['ROI', impactScoreReference.roi],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="border-l-2 border-slate-200 pl-3">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Score changes require reassessment against scoring evidence in the Scoring section.
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {isImpactSection ? 'Impact narrative revision' : `${sectionLabel} revision`}
              </p>
              <Textarea
                value={editValue}
                onChange={(event) => {
                  setEditValue(event.target.value)
                  setEditError(null)
                }}
                className={cn(
                  'mt-3 min-h-[320px] resize-y border-border/80 bg-background text-sm leading-6 shadow-none focus-visible:ring-1',
                  usesCodeFormatting && 'font-mono text-xs leading-5',
                  editError && 'border-rose-300 focus-visible:ring-rose-300',
                )}
              />
              {editError ? (
                <div className="mt-3 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{editError}</span>
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {isImpactSection
                ? 'Enterprise note: saving updates the narrative only; official scoring and generated evidence remain unchanged.'
                : 'Enterprise note: saving creates a new review version; it does not overwrite generated evidence.'}
            </p>
          </div>
          <DialogFooter className="gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 pt-4">
            <Button
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
              onClick={() => setEditOpen(false)}
              disabled={recordBusy}
            >
              <X className="h-4 w-4" aria-hidden /> Cancel
            </Button>
            <Button
              className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
              onClick={() => void saveManualRevision()}
              disabled={!editValue.trim() || recordBusy}
            >
              {recordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {recordBusy ? 'Saving...' : 'Save revision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 p-0 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]">
          <DialogHeader className="mb-0 border-b border-border/70 bg-muted/25 px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20">
                <History className="h-5 w-5" aria-hidden />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-semibold tracking-tight">{sectionLabel} version history</DialogTitle>
                <DialogDescription className="text-sm">Accepted, rejected, approved, and superseded revisions remain available for audit.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-5">
            {record.versions.length === 0 ? (
              <p className="rounded-xl border border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground">No revisions yet.</p>
            ) : record.versions.map((version, index) => (
              <div key={version.id} className="rounded-xl border border-border bg-background/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Clock3 className="h-3.5 w-3.5 text-slate-400" /> Version {record.versions.length - index}
                    <Badge variant="outline" className="text-[10px]">{version.source === 'ai' ? 'AI' : 'Human'} · {version.status}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{version.author} · {new Date(version.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                  {normalizeLegacyStructuredReviewContent(sectionKey, version.content)}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4 pt-4">
            <Button
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), 'w-full justify-center gap-2')}
              onClick={() => setHistoryOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
