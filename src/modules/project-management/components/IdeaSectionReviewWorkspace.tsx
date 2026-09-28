import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Bot, Check, Clock3, History, Loader2, LockKeyhole, MessageSquareText, MessagesSquare, PencilLine, ShieldCheck, X, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  createIdeaSectionRevision,
  getIdeaById,
  getActiveIdeaSectionRevision,
  listIdeaSectionRevisions,
  transitionIdeaSectionRevision,
  type IdeaSectionFieldChange,
  type IdeaSectionRevisionComment,
  type IdeaSectionRevisionApi,
} from '@/lib/api/ideaBacklogApi'
import { fieldsOf } from '@/modules/project-management/components/IdeaSummaryInlineField'
import { summaryFieldLabel } from '@/modules/project-management/lib/summaryFields'
import { ScoreProposalReview, scoreProposalOf, type ScoreProposal } from '@/modules/project-management/components/ScoreProposalReview'
import { IDEA_SECTION_REVISION_UPDATED_EVENT, dispatchIdeaSectionRevisionUpdated } from '@/lib/chat/ideaSectionRevisionFromChat'
import { requestOpenIdeaDiscussChat } from '@/stores/chat-navigation-store'
import { reviewIdeaSummaryRevision, type IdeaSummaryRevisionReview } from '@/lib/api/tectonaAgentRuntimeApi'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { REVIEW_ACTION_TONE } from '@/modules/project-management/lib/reviewActionTone'
import { notifySectionReview, notifySectionThread, type SectionReviewNotifyContext } from '@/lib/notifications/notifySectionReview'
import { ThreadComposer, ThreadView, plainText, threadParticipants, useSectionThreads, type ThreadPerson } from '@/modules/project-management/components/IdeaSectionThreads'
import { reviewerDisplayName, type ReviewerNameResolver } from '@/modules/project-management/lib/reviewerDisplayName'
import { normalizeLegacyStructuredReviewContent } from '@/modules/project-management/lib/ideaSectionReviewContent'
import type { IdeaSectionKey } from '@/lib/api/ideaBacklogApi'

// Same height and type as the drawer's buttons (enterpriseSecondaryButtonClass), a little tighter.
const TOOLBAR_BUTTON = cn(enterpriseSecondaryButtonClass(), 'gap-1.5 px-3 disabled:pointer-events-none disabled:opacity-50')

type ReviewStatus = 'ai_draft' | 'in_review' | 'approved'
type RevisionSource = 'human' | 'ai'

type RevisionVersion = {
  baseRevisionId: string | null
  diff: string[]
  /** Inline summary edits carry per-card changes instead of one text blob. */
  fields: Record<string, string> | null
  fieldChanges: IdeaSectionFieldChange[]
  aiTextAtEdit: string
  /** Set when the reviewer used Suggest AI while writing this revision. */
  aiAssisted: boolean
  /** An AI proposal saved from a Discuss-with-AI conversation. */
  fromChat: boolean
  requiresChecker: boolean
  /** "Score this idea" proposal: scores vs the AI draft (null for any other revision). */
  scoreProposal: ScoreProposal | null
  id: string
  content: string
  source: RevisionSource
  status: 'proposed' | 'accepted' | 'rejected' | 'approved' | 'superseded' | 'changes_requested'
  comments: IdeaSectionRevisionComment[]
  author: string
  createdAt: string
}

type SectionReviewRecord = {
  aiTextAtEdit: string
  status: ReviewStatus
  activeContent: string
  activeRevisionId: string | null
  versions: RevisionVersion[]
  updatedAt: string | null
  /** Who approved the active version, when, and how many summary cards it edits. */
  approvedBy: string | null
  approvedAt: string | null
  editedCardCount: number
}

const EMPTY_RECORD: SectionReviewRecord = {
  aiTextAtEdit: '',
  status: 'ai_draft',
  activeContent: '',
  activeRevisionId: null,
  versions: [],
  updatedAt: null,
  approvedBy: null,
  approvedAt: null,
  editedCardCount: 0,
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
    aiTextAtEdit: String((activeRevision?.content_json._review as { ai_text_at_edit?: string; original_ai_text?: string })?.ai_text_at_edit || (activeRevision?.content_json._review as { original_ai_text?: string })?.original_ai_text || ''),
    status: activeRevision?.status === 'approved'
      ? 'approved'
      : activeRevision?.status === 'accepted'
        ? 'in_review'
        : 'ai_draft',
    activeContent: revisionText(activeRevision),
    activeRevisionId: activeRevision?.id ?? null,
    versions: revisions.map((revision) => ({
      baseRevisionId: String((revision.content_json._review as { base_revision_id?: string | null })?.base_revision_id || '') || null,
      diff: revision.diff || [],
      fields: 'fields' in (revision.content_json ?? {}) ? fieldsOf(revision) : null,
      fieldChanges: revision.field_changes || [],
      aiAssisted: revision.source === 'human' && (revision.evidence_json || []).some((e) => e?.type === 'ai_suggestion'),
      fromChat: revision.source === 'ai' && Boolean(revision.source_session_id),
      aiTextAtEdit: String((revision.content_json._review as { ai_text_at_edit?: string } | undefined)?.ai_text_at_edit || ''),
      requiresChecker: Boolean((revision.content_json._review as { require_checker?: boolean })?.require_checker),
      scoreProposal: scoreProposalOf(revision),
      comments: revision.comments || [],
      id: revision.id,
      content: revisionText(revision),
      source: revision.source,
      status: revision.status,
      author: revision.author_id,
      createdAt: revision.created_date,
    })),
    updatedAt: activeRevision?.updated_date
      || activeRevision?.created_date
      || revisions[0]?.updated_date
      || revisions[0]?.created_date
      || null,
    approvedBy: activeRevision?.status === 'approved' ? (activeRevision.approved_by || activeRevision.author_id) : null,
    approvedAt: activeRevision?.status === 'approved' ? (activeRevision.approved_at || activeRevision.updated_date || activeRevision.created_date) : null,
    editedCardCount: Object.keys(fieldsOf(activeRevision)).length,
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

function EnterpriseReviewDialogShell({
  open,
  onClose,
  busy = false,
  title,
  description,
  titleId,
  icon: Icon,
  iconContainerClassName,
  children,
  footer,
  widthClassName = 'max-w-lg',
}: {
  widthClassName?: string
  open: boolean
  onClose: () => void
  busy?: boolean
  title: string
  description: string
  titleId: string
  icon: LucideIcon
  iconContainerClassName: string
  children: ReactNode
  footer: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, busy, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-[1401] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]',
          widthClassName,
        )}
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                iconContainerClassName,
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
        <div className="space-y-3 px-6 py-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
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
  resolveName?: ReviewerNameResolver
  /** Who to notify about review steps; omitted, no notifications are sent. */
  notifyContext?: SectionReviewNotifyContext
  /** Members that can be @mentioned in version discussions. */
  people?: ThreadPerson[]
  sectionKey: IdeaSectionKey
  sectionLabel: string
  currentContent: string
  /** Set while there is nothing to approve yet (e.g. Scoring without evidence):
   *  it replaces the status badge and text, and Approve is not offered. */
  pendingReason?: string | null
  /** The idea's owner: may not approve its official scores (idea-backlog enforces it too). */
  ideaOwnerId?: string | null
}

export function IdeaSectionReviewWorkspace({
  ideaId,
  ideaTitle,
  ideaDescription,
  workspaceId,
  userId,
  userName,
  resolveName,
  notifyContext,
  people = [],
  sectionKey,
  sectionLabel,
  currentContent,
  pendingReason = null,
  ideaOwnerId = null,
}: IdeaSectionReviewWorkspaceProps) {
  const [record, setRecord] = useState<SectionReviewRecord>(EMPTY_RECORD)
  const [recordLoading, setRecordLoading] = useState(true)
  const [recordBusy, setRecordBusy] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [requireChecker, setRequireChecker] = useState(false)
  const [editBaseId, setEditBaseId] = useState<string | null>(null)
  // Advisory AI checks per pending revision, shown to the checker only; the
  // decision to approve stays with them and nothing here is persisted.
  // Reviewer feedback being written for one version: a revision request
  // (comment required) or a rejection (comment optional).
  const threads = useSectionThreads(ideaId, sectionKey)
  const openRevisionRequests = threads.threads.filter((t) => t.kind === 'revision_request')
  const [discussVersionId, setDiscussVersionId] = useState<string | null>(null)
  // Notification deep link to a thread on a version (not on a card): open Version history.
  useEffect(() => {
    const threadId = new URLSearchParams(window.location.search).get('thread')
    if (!threadId) return
    const thread = threads.threads.find((t) => t.id === threadId)
    if (!thread || thread.field_key) return
    setHistoryOpen(true)
    const params = new URLSearchParams(window.location.search)
    params.delete('thread')
    const query = params.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [threads.threads])
  const nameOfReviewer = (id: string) => reviewerDisplayName(id, { userId, userName, resolve: resolveName })

  const [feedback, setFeedback] = useState<{ versionId: string; action: 'request_changes' | 'reject' | 'approve'; text: string } | null>(null)
  // Official scores need a second person: never the proposer, never the idea's owner.
  const scoreApprovalBlock = (version: RevisionVersion): string | null => {
    if (!version.scoreProposal || !userId) return null
    if (version.author === userId) return 'You proposed these scores: another reviewer approves them.'
    if (ideaOwnerId && ideaOwnerId === userId) return "The idea's owner cannot approve its scores: another reviewer approves them."
    return null
  }

  // A review notification links here with ?review=<section>: open Version history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('review') !== sectionKey) return
    setHistoryOpen(true)
    params.delete('review')
    const query = params.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [sectionKey])

  const [aiChecks, setAiChecks] = useState<Record<string, { loading: boolean; result?: IdeaSummaryRevisionReview; error?: string }>>({})

  const runAiCheck = async (revisionId: string) => {
    setAiChecks((prev) => ({ ...prev, [revisionId]: { loading: true } }))
    try {
      const result = await reviewIdeaSummaryRevision({ idea_id: ideaId, revision_id: revisionId })
      setAiChecks((prev) => ({ ...prev, [revisionId]: { loading: false, result } }))
    } catch (error) {
      setAiChecks((prev) => ({ ...prev, [revisionId]: { loading: false, error: error instanceof Error ? error.message : 'Cek AI gagal.' } }))
    }
  }
  const pendingVersion = record.versions.find((v) => (v.status === 'accepted' || v.status === 'proposed') && v.id !== record.activeRevisionId)
  const pendingCount = record.versions.filter((v) => (v.status === 'accepted' || v.status === 'proposed') && v.id !== record.activeRevisionId).length
  // Nothing approved and nothing to review: the section is waiting for input, not for a decision.
  const awaitingInput = Boolean(pendingReason) && !recordLoading && record.status !== 'approved' && !pendingCount
  const aiChanged = Boolean(record.activeRevisionId && record.aiTextAtEdit && record.aiTextAtEdit.trim() !== currentContent.trim())

  const meta = statusMeta(pendingVersion ? 'in_review' : record.status)
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
  }, [ideaId, sectionKey, currentContent])

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ ideaId?: string; sectionKey?: string }>).detail
      if (detail?.ideaId !== ideaId || detail?.sectionKey !== sectionKey) return
      void refreshRecord().catch((error) => setRecordError(error instanceof Error ? error.message : 'Revisi belum dapat dimuat.'))
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
      baseRevisionId?: string | null
    },
  ) => {
    const body = {
      content_json: { text: content },
      source,
      base_revision_id: metadata && 'baseRevisionId' in metadata ? metadata.baseRevisionId : record.activeRevisionId,
      original_ai_text: currentContent,
      require_checker: source === 'human' && requireChecker,
      confidence_score: metadata?.confidenceScore,
      evidence_json: metadata?.evidence ?? [],
      source_session_id: metadata?.sourceSessionId,
    }
    const created = await createIdeaSectionRevision(ideaId, sectionKey, body)
    await transitionIdeaSectionRevision(ideaId, sectionKey, created.id, transition)
    await refreshRecord()
    dispatchIdeaSectionRevisionUpdated(ideaId, sectionKey)
  }

  const openEditor = () => {
    setEditError(null)
    setEditBaseId(record.activeRevisionId)
    setRequireChecker(pendingVersion?.requiresChecker || false)
    if (isImpactSection) {
      const existingNarrative = (pendingVersion?.content || record.activeContent).trim()
        ? stripImpactScoreFields(pendingVersion?.content || record.activeContent)
        : ''
      setEditValue(existingNarrative || buildImpactNarrativeDraft(currentContent))
    } else {
      setEditValue(pendingVersion?.content || sourceContent)
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
      await createAndTransitionRevision(content, 'human', 'accept', { baseRevisionId: editBaseId })
      setEditOpen(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'The revision could not be saved.')
    } finally {
      setRecordBusy(false)
    }
  }

  const openAiReview = async () => {
    let reviewedDescription = ideaDescription
    try {
      const idea = await getIdeaById(ideaId)
      const sections = Object.entries(idea.approved_sections || {})
        .map(([key, revision]) => `${key} (approved):\n${String(revision?.content_json.text || '')}`)
      if (sections.length) reviewedDescription = `${ideaDescription}\n\nApproved section revisions:\n${sections.join('\n\n')}`
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Approved revisions could not be loaded for AI review.')
      return
    }
    requestOpenIdeaDiscussChat({
      ideaId,
      ideaTitle,
      sectionKey,
      sectionLabel,
      ideaDescription: reviewedDescription,
      currentSectionContent: sourceContent,
      workspaceId,
      userId,
      isImpactSection,
    })
  }

  const approveRevision = async (
    revisionId?: string,
    transition: 'approve' | 'reject' | 'request_changes' = 'approve',
    comment?: string,
  ) => {
    const content = isImpactSection ? stripImpactScoreFields(availableContent) : availableContent.trim()
    if (!content) return
    setRecordBusy(true)
    setRecordError(null)
    try {
      const targetId = revisionId || pendingVersion?.id || record.activeRevisionId
      if (targetId) {
        await transitionIdeaSectionRevision(ideaId, sectionKey, targetId, transition, comment)
        const target = record.versions.find((v) => v.id === targetId)
        if (target && target.source === 'human') {
          notifySectionReview(notifyContext, { kind: transition, sectionKey, sectionLabel, revisionId: targetId, authorId: target.author, comment })
        }
        setFeedback(null)
        await refreshRecord()
      } else {
        await createAndTransitionRevision(content, 'ai', 'approve')
      }
      dispatchIdeaSectionRevisionUpdated(ideaId, sectionKey)
      // Approving proposed scores writes the official scores (idea-backlog): reload the idea.
      if (sectionKey === 'scoring' && transition === 'approve') {
        window.dispatchEvent(new CustomEvent('tectona:idea-updated', { detail: { ideaId } }))
      }
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'The revision could not be approved.')
    } finally {
      setRecordBusy(false)
    }
  }

  const compareGenerated = async () => {
    setRecordBusy(true)
    setRecordError(null)
    setHistoryOpen(true)
    try {
      const text = isImpactSection ? stripImpactScoreFields(currentContent) : currentContent
      if (!record.versions.some((v) => v.source === 'ai' && (v.content === text || v.aiTextAtEdit === text) && (v.status === 'proposed' || v.status === 'accepted'))) {
        await createIdeaSectionRevision(ideaId, sectionKey, {
          source: 'ai', content_json: { text }, base_revision_id: record.activeRevisionId,
          original_ai_text: currentContent,
        })
        await refreshRecord()
        dispatchIdeaSectionRevisionUpdated(ideaId, sectionKey)
      }
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Perbandingan belum dapat dimuat.')
    } finally { setRecordBusy(false) }
  }

  const rebaseVersion = async (version: RevisionVersion) => {
    setRecordBusy(true)
    setRecordError(null)
    try {
      await createIdeaSectionRevision(ideaId, sectionKey, {
        source: version.source,
        content_json: version.fields ? { fields: version.fields } : { text: version.content },
        base_revision_id: record.activeRevisionId,
        original_ai_text: version.source === 'ai' ? version.content : record.aiTextAtEdit || currentContent,
        require_checker: version.requiresChecker,
      })
      await refreshRecord()
      dispatchIdeaSectionRevisionUpdated(ideaId, sectionKey)
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Versi tidak dapat dibandingkan ulang.')
    } finally { setRecordBusy(false) }
  }

  return (
    <>
      {/* Information (status, who approved, what changed) is plain text and
          pills on the left; everything clickable is a bordered button on the
          right, the same height as the drawer's buttons. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Badge
          variant="outline"
          className={cn('h-6 shrink-0 cursor-default px-2 text-[10px] font-semibold', meta.className)}
          title={record.updatedAt ? `Last reviewed ${new Date(record.updatedAt).toLocaleString()}` : 'AI output requires human review'}
        >
          {recordLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          {awaitingInput ? pendingReason : meta.label}
        </Badge>
        {openRevisionRequests.length ? (
          <Badge variant="outline" className="h-6 shrink-0 cursor-default border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-800"
            title={openRevisionRequests.map((t) => `${nameOfReviewer(t.created_by)} → ${nameOfReviewer(t.assignee_id ?? '')}: ${t.comments[0]?.body ?? ''}`).join('\n')}>
            Revision requested{openRevisionRequests.length > 1 ? ` (${openRevisionRequests.length})` : ''}
          </Badge>
        ) : null}
        {/* The section's review status lives here, next to the status badge,
            instead of a separate line above the cards. */}
        {awaitingInput ? null : <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground sm:inline"
          title={record.approvedAt ? `Approved ${new Date(record.approvedAt).toLocaleString('en-GB')}` : undefined}>
          {recordLoading
            ? 'Loading revision history...'
            : record.approvedBy
              ? <>Approved by <span className="font-medium text-foreground">{nameOfReviewer(record.approvedBy)}</span> · {new Date(record.approvedAt || record.updatedAt || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
              : record.updatedAt
                ? `Reviewed ${new Date(record.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'AI output requires human review'}
        </span>}
        {!recordLoading && record.editedCardCount ? (
          <button type="button" onClick={() => setHistoryOpen(true)} title="Open Version history"
            className="hidden shrink-0 text-[11px] font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary sm:inline">
            {record.editedCardCount} {record.editedCardCount === 1 ? 'card' : 'cards'} edited
          </button>
        ) : null}
        {recordError ? (
          <span
            className="inline-flex h-6 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-700"
            title={recordError}
          >
            <AlertCircle className="h-3 w-3" /> Error
          </span>
        ) : null}
        {/* "AI unchanged" is a state, not an action: only a new AI version is a button. */}
        {record.activeRevisionId && !aiChanged ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground" title="The AI output has not changed since the approved version">
            <Check className="h-3.5 w-3.5" aria-hidden /> AI unchanged
          </span>
        ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {/* Summary and Scoring are edited card by card (IdeaSummaryInlineField;
            Scoring also through "Score this idea"): their title and figures are
            locked, which a free-text editor cannot honour (idea-backlog refuses it). */}
        {sectionKey === 'summary' || sectionKey === 'scoring' || awaitingInput ? null : (
          <Button type="button" variant="outline" className={TOOLBAR_BUTTON} onClick={openEditor} disabled={recordLoading || recordBusy}>
            <PencilLine className="h-4 w-4" /> Edit
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className={TOOLBAR_BUTTON}
          title="Open Chat panel and continue this idea with Tectona Assistant"
          onClick={openAiReview}
          disabled={recordLoading || recordBusy}
        >
          <Bot className="h-4 w-4" /> Discuss with AI
        </Button>
        <Button type="button" variant="outline" className={cn(TOOLBAR_BUTTON, 'w-10 !px-0')} title="Version history" aria-label="Version history" onClick={() => setHistoryOpen(true)} disabled={recordLoading || recordBusy}>
          <History className="h-4 w-4" />
        </Button>
        {record.activeRevisionId && aiChanged ? <Button type="button" variant="outline" className={cn(TOOLBAR_BUTTON, REVIEW_ACTION_TONE.outline)} disabled={recordLoading || recordBusy || !!recordError} onClick={() => void compareGenerated()}>
          <History className="h-4 w-4" /> New AI version: compare
        </Button> : null}
        {/* Pending edits are decided in Version history (before/after, AI check,
            request changes), so the header offers "Review (n)" instead of an
            Approve that would only open the dialog. Approve here is reserved for
            accepting the AI output as-is when nothing was approved yet. */}
        {pendingCount ? (
          <Button type="button" variant="outline" className={cn(TOOLBAR_BUTTON, REVIEW_ACTION_TONE.soft)}
            title={`${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting for review`}
            onClick={() => setHistoryOpen(true)} disabled={recordLoading || recordBusy}>
            <History className="h-4 w-4" /> Review ({pendingCount})
          </Button>
        ) : record.status !== 'approved' && !awaitingInput ? (
          <Button type="button" variant="outline" className={TOOLBAR_BUTTON}
            title="Approve the current AI output as the official version"
            onClick={() => void approveRevision()} disabled={recordLoading || recordBusy || !availableContent}>
            {recordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
          </Button>
        ) : null}
        </div>
      </div>

      <EnterpriseReviewDialogShell
        open={editOpen}
        onClose={() => {
          if (!recordBusy) setEditOpen(false)
        }}
        busy={recordBusy}
        title={`Edit ${sectionLabel}`}
        description="Create a human revision while preserving the original AI evidence and audit history."
        titleId={`idea-section-edit-${sectionKey}`}
        icon={PencilLine}
        iconContainerClassName="bg-primary/12 text-primary ring-primary/25"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
              onClick={() => setEditOpen(false)}
              disabled={recordBusy}
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
              Cancel
            </Button>
            <Button
              type="button"
              className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
              onClick={() => void saveManualRevision()}
              disabled={!editValue.trim() || recordBusy}
            >
              {recordBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Check className="h-4 w-4 shrink-0" aria-hidden />}
              {recordBusy ? 'Saving...' : 'Save revision'}
            </Button>
          </>
        }
      >
        {isImpactSection ? (
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Official scoring reference
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
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
                <div key={label} className="border-l-2 border-border pl-3">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
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
              'mt-3 min-h-[180px] max-h-[36vh] resize-y border-border/80 bg-background text-sm leading-6 shadow-none focus-visible:ring-1',
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requireChecker} onChange={(e) => setRequireChecker(e.target.checked)} />
          Requires approval from another reviewer
        </label>
        <p className="text-xs text-muted-foreground">
          {isImpactSection
            ? 'Enterprise note: saving updates the narrative only; official scoring and generated evidence remain unchanged.'
            : 'The revision is saved as Pending review. Approving it makes the content active on the page and available to AI processes.'}
        </p>
      </EnterpriseReviewDialogShell>

      <EnterpriseReviewDialogShell
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        widthClassName="max-w-3xl"
        title={`${sectionLabel} version history`}
        description="Accepted, rejected, approved, and superseded revisions remain available for audit."
        titleId={`idea-section-history-${sectionKey}`}
        icon={History}
        iconContainerClassName="bg-slate-500/10 text-slate-700 ring-slate-500/20"
        footer={
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'w-full justify-center gap-2')}
            onClick={() => setHistoryOpen(false)}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Close
          </Button>
        }
      >
        <div className="enterprise-popover-scroll max-h-[48vh] space-y-3 overflow-y-auto">
          {recordError ? <p role="alert" className="text-sm text-rose-700">{recordError}</p> : null}
          {record.status === 'approved' && pendingVersion ? <p className="text-sm text-amber-800">Ada versi baru untuk dibandingkan. Versi approved tetap digunakan sampai kamu memilih penggantinya.</p> : null}
          {record.versions.length === 0 ? (
            <p className="rounded-xl border border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground">No revisions yet.</p>
          ) : record.versions.map((version, index) => (
            <div key={version.id} className="rounded-xl border border-border bg-background/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Clock3 className="h-3.5 w-3.5 text-muted-foreground" /> Version {record.versions.length - index}
                  <Badge variant="outline" className="text-[10px]">{version.source === 'ai' ? 'AI' : 'Human'}{version.fromChat ? ' · from chat' : ''}{version.aiAssisted ? ' · dibantu AI' : ''} · {version.status === 'changes_requested' ? 'perlu revisi' : version.status}</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">{reviewerDisplayName(version.author, { userId, userName, resolve: resolveName })} · {new Date(version.createdAt).toLocaleString()}</span>
              </div>
              {version.scoreProposal ? (
                <ScoreProposalReview ideaId={ideaId} revisionId={version.id} proposal={version.scoreProposal}
                  canReview={(version.status === 'accepted' || version.status === 'proposed') && !scoreApprovalBlock(version)} />
              ) : (
                <p className="enterprise-popover-scroll mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                  {normalizeLegacyStructuredReviewContent(sectionKey, version.content)}
                </p>
              )}
              {version.fieldChanges.length ? (
                <div className="mt-3 space-y-2 text-xs">
                  {version.fieldChanges.map((change) => (
                    <div key={change.field} className="rounded-lg border border-border p-2">
                      <p className="font-semibold text-foreground">{summaryFieldLabel(change.field)}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words bg-rose-50 px-1.5 py-1 text-rose-900"><span className="sr-only">Sebelum: </span>{change.before || '(kosong)'}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words bg-emerald-50 px-1.5 py-1 text-emerald-900"><span className="sr-only">Sesudah: </span>{change.after}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-medium">{version.fieldChanges.length ? 'Full summary text vs. base version' : 'Changes vs. base version'}</summary>
                <pre className="enterprise-popover-scroll mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono">{version.diff.length ? version.diff.map((line, i) => <div key={i} className={line.startsWith('+') ? 'bg-emerald-50 text-emerald-900' : line.startsWith('-') ? 'bg-rose-50 text-rose-900' : ''}>{line}</div>) : 'No text changes.'}</pre>
              </details>
              {version.status === 'accepted' || version.status === 'proposed' ? <>
              {/* Review actions: drawer-height (h-10) buttons that share the full row. */}
              <div className="mt-3 flex w-full items-stretch gap-2 [&>button]:min-w-0 [&>button]:flex-auto [&>button]:px-3">
                <Button
                  type="button"
                  className={registerServicePrimaryButtonClass()}
                  disabled={recordBusy || (version.requiresChecker && version.author === userId) || Boolean(scoreApprovalBlock(version))}
                  title={scoreApprovalBlock(version) ?? undefined}
                  onClick={() => (version.scoreProposal?.changes.some((c) => c.major)
                    ? setFeedback({ versionId: version.id, action: 'approve', text: '' })
                    : void approveRevision(version.id))}
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">Approve</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(enterpriseSecondaryButtonClass(), REVIEW_ACTION_TONE.soft)}
                  disabled={recordBusy || version.author === userId}
                  title={version.author === userId ? 'You cannot request changes on your own edit.' : 'Send back to the author with a comment'}
                  onClick={() => setFeedback({ versionId: version.id, action: 'request_changes', text: '' })}
                >
                  <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">Request changes</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(enterpriseSecondaryButtonClass(), REVIEW_ACTION_TONE.destructive)}
                  disabled={recordBusy}
                  title="Reject and keep the active version"
                  onClick={() => setFeedback({ versionId: version.id, action: 'reject', text: '' })}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">Reject</span>
                </Button>
                {version.baseRevisionId !== record.activeRevisionId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(enterpriseSecondaryButtonClass(), REVIEW_ACTION_TONE.outline)}
                    disabled={recordBusy}
                    title="Rebase this version on the active version"
                    onClick={() => void rebaseVersion(version)}
                  >
                    <History className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">Compare with active</span>
                  </Button>
                ) : null}
                {sectionKey === 'summary' && version.fieldChanges.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(enterpriseSecondaryButtonClass(), REVIEW_ACTION_TONE.outline)}
                    disabled={recordBusy || aiChecks[version.id]?.loading}
                    onClick={() => void runAiCheck(version.id)}
                  >
                    {aiChecks[version.id]?.loading
                      ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      : <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />}
                    <span className="truncate">Check with AI</span>
                  </Button>
                ) : null}
              </div>
              {version.requiresChecker && version.author === userId ? <p className="mt-2 text-xs text-muted-foreground">Waiting for another reviewer.</p> : null}
              {scoreApprovalBlock(version) ? <p className="mt-2 text-xs text-muted-foreground">{scoreApprovalBlock(version)}</p> : null}
              {feedback?.versionId === version.id ? (
                <ReviewFeedbackBox
                  action={feedback.action}
                  text={feedback.text}
                  busy={recordBusy}
                  onChange={(text) => setFeedback({ ...feedback, text })}
                  onCancel={() => setFeedback(null)}
                  onSubmit={() => void approveRevision(version.id, feedback.action, feedback.text)}
                />
              ) : null}
              </> : null}
              {version.status === 'changes_requested' ? (
                <p className="mt-3 text-xs font-medium text-amber-800">
                  Menunggu revisi dari {reviewerDisplayName(version.author, { userId, userName, resolve: resolveName })}. Versi ini tidak bisa di-approve sampai diperbarui.
                </p>
              ) : null}
              {version.comments.length ? (
                <ReviewComments comments={version.comments} nameOf={(id) => reviewerDisplayName(id, { userId, userName, resolve: resolveName })} />
              ) : null}
              {threads.threads.filter((t) => t.revision_id === version.id).map((thread) => (
                <div key={thread.id} className="mt-3">
                  <ThreadView
                    thread={thread}
                    nameOf={nameOfReviewer}
                    currentUserId={userId}
                    people={people}
                    onReply={async (body, mentionIds) => {
                      await threads.reply(thread.id, body)
                      notifySectionThread(notifyContext, { kind: 'mention', sectionKey, targetLabel: `${sectionLabel} · version`, threadId: thread.id, recipients: mentionIds, excerpt: plainText(body) })
                      notifySectionThread(notifyContext, { kind: 'reply', sectionKey, targetLabel: `${sectionLabel} · version`, threadId: thread.id, recipients: threadParticipants(thread).filter((id) => !mentionIds.includes(id)), excerpt: plainText(body) })
                    }}
                    onClose={async () => { await threads.close(thread.id) }}
                  />
                </div>
              ))}
              {version.status === 'accepted' || version.status === 'proposed' || version.status === 'changes_requested' ? (
                discussVersionId === version.id ? (
                  <div className="mt-3">
                    <ThreadComposer
                      kind="discussion"
                      people={people}
                      onCancel={() => setDiscussVersionId(null)}
                      onSubmit={async (body, _assignee, mentionIds) => {
                        const thread = await threads.create({ kind: 'discussion', body, revision_id: version.id })
                        notifySectionThread(notifyContext, { kind: 'mention', sectionKey, targetLabel: `${sectionLabel} · version`, threadId: thread.id, recipients: mentionIds, excerpt: plainText(body) })
                        notifySectionThread(notifyContext, {
                          kind: 'discussion_opened', sectionKey, targetLabel: `${sectionLabel} · version`, threadId: thread.id, excerpt: plainText(body),
                          recipients: [version.author, ...(notifyContext?.reviewerIds ?? [])].filter((id) => !mentionIds.includes(id)),
                        })
                        setDiscussVersionId(null)
                      }}
                    />
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="ghost" className="mt-2 h-7 gap-1 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary" onClick={() => setDiscussVersionId(version.id)}>
                    <MessagesSquare className="h-3.5 w-3.5" aria-hidden /> Discuss this version
                  </Button>
                )
              ) : null}
              {aiChecks[version.id] && !aiChecks[version.id].loading ? (
                <AiCheckResult check={aiChecks[version.id]} />
              ) : null}
            </div>
          ))}
        </div>
      </EnterpriseReviewDialogShell>
    </>
  )
}

const AI_FINDING_LABEL: Record<string, string> = {
  unsupported_claim: 'Not in the sources',
  contradiction: 'Contradiction',
  lost_information: 'Information removed',
}

function cardLabel(field: string) {
  return summaryFieldLabel(field)
}

function AiCheckResult({ check }: { check: { result?: IdeaSummaryRevisionReview; error?: string } }) {
  if (check.error) return <p role="alert" className="mt-3 text-xs text-destructive">{check.error}</p>
  const result = check.result
  if (!result) return null
  const cards = result.checked_fields.map(cardLabel).join(', ')
  const count = result.findings.length
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs" aria-label="AI check result">
      <p className="font-semibold text-foreground">
        {count ? `AI check: ${count} ${count === 1 ? 'issue' : 'issues'} found` : 'AI check: no issues found'}
      </p>
      <p className="mt-1 text-muted-foreground">
        Compared the changed {result.checked_fields.length === 1 ? 'card' : 'cards'} ({cards}) against: {result.checked_sources.join(' · ')}.
      </p>
      {result.summary ? <p className="mt-2 text-foreground">{result.summary}</p> : null}
      {count ? (
        <ul className="mt-2 space-y-2">
          {result.findings.map((finding, i) => (
            <li key={i} className="rounded-md border border-amber-200 bg-background/80 p-2">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {cardLabel(finding.field)} · {AI_FINDING_LABEL[finding.type] ?? finding.type}
              </p>
              <p className="mt-1 italic text-foreground">“{finding.quote}”</p>
              <p className="mt-1 text-muted-foreground">{finding.explanation}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        This does not verify that the content is true, only that it is consistent with these sources. It does not change the revision; approval stays with the reviewer.
      </p>
    </div>
  )
}

const COMMENT_ACTION_LABEL: Record<IdeaSectionRevisionComment['action'], string> = {
  request_changes: 'minta revisi',
  reject: 'menolak',
  approve: 'menyetujui',
}

function ReviewComments({ comments, nameOf }: { comments: IdeaSectionRevisionComment[]; nameOf: (id: string) => string }) {
  return (
    <ul className="mt-3 space-y-2 text-xs" aria-label="Komentar reviewer">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
          <p className="font-medium text-amber-900">
            {nameOf(comment.author_id)} {COMMENT_ACTION_LABEL[comment.action]} · {new Date(comment.created_at).toLocaleString()}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{comment.body}</p>
        </li>
      ))}
    </ul>
  )
}

function ReviewFeedbackBox({ action, text, busy, onChange, onCancel, onSubmit }: {
  action: 'request_changes' | 'reject' | 'approve'
  text: string
  busy: boolean
  onChange: (text: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const required = action === 'request_changes' || action === 'approve'
  const approving = action === 'approve'
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <label className="block text-xs font-semibold text-foreground" htmlFor="section-review-feedback">
        {approving ? 'Komentar persetujuan (wajib: ada perubahan besar dari draft AI)' : required ? 'Apa yang perlu direvisi?' : 'Alasan penolakan (opsional)'}
      </label>
      <Textarea
        id="section-review-feedback"
        autoFocus
        value={text}
        maxLength={2000}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        placeholder={approving ? 'Contoh: Sudah dicek dengan tim; hasil UAT Ivanti mendukung Risk yang lebih rendah.' : required ? 'Contoh: Poin ke-3 terlalu umum, sebutkan target SLA eskalasinya.' : 'Contoh: Sudah dicakup di Strategic Response.'}
        className="min-h-[88px] resize-y rounded-lg bg-background text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Batal</Button>
        <Button size="sm" variant={required ? 'default' : 'outline'} disabled={busy || (required && !text.trim())} onClick={onSubmit}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {approving ? 'Setujui skor' : required ? 'Kirim permintaan revisi' : 'Tolak versi ini'}
        </Button>
      </div>
    </div>
  )
}
