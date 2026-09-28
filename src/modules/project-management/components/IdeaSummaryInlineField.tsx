import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, Check, Clock3, Loader2, MessageSquarePlus, MessageSquareText, MessagesSquare, PencilLine, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createIdeaSectionRevision,
  listIdeaSectionRevisions,
  transitionIdeaSectionRevision,
  type IdeaSectionRevisionApi,
} from '@/lib/api/ideaBacklogApi'
import { suggestIdeaSummaryField, type IdeaSummaryFieldKey } from '@/lib/api/tectonaAgentRuntimeApi'
import { IDEA_SECTION_REVISION_UPDATED_EVENT, dispatchIdeaSectionRevisionUpdated } from '@/lib/chat/ideaSectionRevisionFromChat'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { REVIEW_ACTION_TONE } from '@/modules/project-management/lib/reviewActionTone'
import { notifySectionReview, notifySectionThread, type SectionReviewNotifyContext } from '@/lib/notifications/notifySectionReview'
import {
  CommentsHoverPopover, ThreadComposer, ThreadView, plainText, threadParticipants, useSectionThreads,
  type SectionThreadsApi, type ThreadPerson,
} from '@/modules/project-management/components/IdeaSectionThreads'
import { reviewerDisplayName, type ReviewerNameResolver } from '@/modules/project-management/lib/reviewerDisplayName'

import {
  SUMMARY_FIELD_LABELS, isEditableSummaryFieldKey, summaryFieldLabel,
  type ReadinessAnchorKey, type SummaryFieldKey,
} from '@/modules/project-management/lib/summaryFields'

export { SUMMARY_FIELD_LABELS, type SummaryFieldKey }

type FieldReview = { field_authors?: Record<string, string>; require_checker?: boolean }

type SummaryFieldState = {
  approvedFields: Partial<Record<SummaryFieldKey, string>>
  fieldAuthors: Record<string, string>
  activeRevisionId: string | null
  pending: IdeaSectionRevisionApi | null
  pendingFields: Partial<Record<SummaryFieldKey, string>>
  /** Set when a reviewer sent the pending edit back: the latest request. */
  revisionRequest: { authorId: string; body: string } | null
}

/** The sections edited card by card. */
export type InlineFieldSectionKey = 'summary' | 'scoring'

type SummaryFieldContextValue = SummaryFieldState & {
  ideaId: string
  sectionKey: InlineFieldSectionKey
  sectionLabel: string
  currentContent: string
  userId?: string | null
  userName?: string | null
  displayName: (id: string) => string
  refresh: () => Promise<void>
  notifyContext?: SectionReviewNotifyContext
  threads: SectionThreadsApi
  /** People a revision can be assigned to (identity directory). */
  people: ThreadPerson[]
  /** Default assignee for a card nobody has edited yet. */
  ideaOwnerId?: string
  /** Thread to open on load (notification deep link ?thread=). */
  focusThreadId: string | null
}

const SummaryFieldContext = createContext<SummaryFieldContextValue | null>(null)

const EMPTY_STATE: SummaryFieldState = {
  approvedFields: {}, fieldAuthors: {}, activeRevisionId: null, pending: null, pendingFields: {}, revisionRequest: null,
}

export function fieldsOf(revision: IdeaSectionRevisionApi | null | undefined): Partial<Record<SummaryFieldKey, string>> {
  const raw = revision?.content_json?.fields
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([key, value]) => isEditableSummaryFieldKey(key) && typeof value === 'string'),
  ) as Partial<Record<SummaryFieldKey, string>>
}

export function summaryFieldStateFrom(revisions: IdeaSectionRevisionApi[]): SummaryFieldState {
  const ordered = [...revisions].sort((a, b) => b.revision_number - a.revision_number)
  const active = ordered.find((r) => r.status === 'approved') ?? null
  // Only inline (field) edits are surfaced on the cards; a legacy free-text
  // revision keeps its own review flow in Version history.
  // An edit sent back for changes stays the pending one: its author revises
  // it (the new revision supersedes it on accept) and nobody else can edit.
  // AI card edits proposed from a Discuss-with-AI chat count too: they wait for
  // review like any edit (AI regenerations carry no chat session and do not).
  const pending = ordered.find((r) => (r.status === 'accepted' || r.status === 'proposed' || r.status === 'changes_requested')
    && (r.source === 'human' || Boolean(r.source_session_id)) && 'fields' in (r.content_json ?? {})) ?? null
  const request = pending?.status === 'changes_requested'
    ? [...(pending.comments ?? [])].reverse().find((c) => c.action === 'request_changes') ?? null
    : null
  return {
    approvedFields: fieldsOf(active),
    fieldAuthors: ((active?.content_json?._review ?? {}) as FieldReview).field_authors ?? {},
    activeRevisionId: active?.id ?? null,
    pending,
    pendingFields: fieldsOf(pending),
    revisionRequest: request ? { authorId: request.author_id, body: request.body } : null,
  }
}

export function IdeaSummaryFieldReviewProvider({
  ideaId, sectionKey = 'summary', currentContent, userId, userName, resolveName, notifyContext, people = [], ideaOwnerId, children,
}: {
  ideaId: string; sectionKey?: InlineFieldSectionKey; currentContent: string; userId?: string | null; userName?: string | null
  resolveName?: ReviewerNameResolver; notifyContext?: SectionReviewNotifyContext
  people?: ThreadPerson[]; ideaOwnerId?: string; children: ReactNode
}) {
  const [state, setState] = useState<SummaryFieldState>(EMPTY_STATE)
  const threads = useSectionThreads(ideaId, sectionKey)
  const [focusThreadId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('thread')
  })

  const refresh = useCallback(async () => {
    setState(summaryFieldStateFrom(await listIdeaSectionRevisions(ideaId, sectionKey)))
  }, [ideaId, sectionKey])

  useEffect(() => {
    setState(EMPTY_STATE)
  }, [ideaId])

  useEffect(() => {
    let alive = true
    const load = () => {
      void listIdeaSectionRevisions(ideaId, sectionKey)
        .then((revisions) => { if (alive) setState(summaryFieldStateFrom(revisions)) })
        // A failed lookup leaves the AI cards as they are; IdeaReviewedSectionContent
        // already tells the user the approved version could not be loaded.
        .catch(() => undefined)
    }
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.ideaId === ideaId && detail?.sectionKey === sectionKey) load()
    }
    load()
    window.addEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate)
    return () => { alive = false; window.removeEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate) }
  }, [ideaId, sectionKey, currentContent])

  const value = useMemo<SummaryFieldContextValue>(() => ({
    ...state,
    ideaId,
    sectionKey,
    sectionLabel: sectionKey === 'scoring' ? 'Scoring' : 'Summary',
    currentContent,
    userId,
    userName,
    displayName: (id: string) => reviewerDisplayName(id, { userId, userName, resolve: resolveName }),
    refresh,
    notifyContext,
    threads,
    people,
    ideaOwnerId,
    focusThreadId,
  }), [state, ideaId, sectionKey, currentContent, userId, userName, resolveName, refresh, notifyContext, threads, people, ideaOwnerId, focusThreadId])

  return <SummaryFieldContext.Provider value={value}>{children}</SummaryFieldContext.Provider>
}

export function SummaryInlineField({ field, aiValue, tone = 'light', render, label: labelProp, commentOnly = false }: {
  /** An editable card/item, or (commentOnly) a Governance Readiness signal. */
  field: SummaryFieldKey | ReadinessAnchorKey
  aiValue: string
  tone?: 'light' | 'dark'
  render: (value: string) => ReactNode
  /** Label override, e.g. "Strategic Framing · Execution Plan". */
  label?: string
  /** Discussion only: no edit, no revision request (system assessments). */
  commentOnly?: boolean
}) {
  const ctx = useContext(SummaryFieldContext)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [requireChecker, setRequireChecker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  // Set while the draft holds AI wording: what the reviewer had before, and
  // what the model said it changed. Saved revisions record the assist.
  const [aiAssist, setAiAssist] = useState<{ previous: string; notes: string; modelId: string | null; instruction: string } | null>(null)
  // Bumped to open (and pin) the comment popover from the request banner or a deep link.
  const [popoverSignal, setPopoverSignal] = useState(0)
  const [composer, setComposer] = useState<'discussion' | 'revision_request' | null>(null)
  const focusedHere = Boolean(ctx?.focusThreadId && ctx.threads.threads.some((t) => t.id === ctx.focusThreadId && t.field_key === field))
  useEffect(() => {
    if (!focusedHere) return
    setPopoverSignal((n) => n + 1)
    const params = new URLSearchParams(window.location.search)
    params.delete('thread')
    const query = params.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [focusedHere])

  if (!ctx) return <>{render(aiValue)}</>

  const label = labelProp ?? summaryFieldLabel(field)
  const value = ctx.approvedFields[field] ?? aiValue
  const pendingAuthor = ctx.pending?.author_id ?? ''
  const pendingIsOwn = Boolean(ctx.pending && pendingAuthor === ctx.userId)
  const pendingValue = ctx.pendingFields[field]
  const hasPendingChange = pendingValue !== undefined && pendingValue !== value
  const needsRevision = ctx.pending?.status === 'changes_requested'
  // Another reviewer's edit is waiting: saving now would silently replace it,
  // so the card stays read-only until that edit is approved or rejected.
  const blockedByOther = Boolean(ctx.pending && !pendingIsOwn)
  const editedBy = ctx.approvedFields[field] !== undefined ? ctx.displayName(ctx.fieldAuthors[field] || '') : ''
  const dark = tone === 'dark'
  const fieldThreads = ctx.threads.threads.filter((t) => t.field_key === field)
  const openRequest = fieldThreads.find((t) => t.kind === 'revision_request') ?? null
  const target = `${ctx.sectionLabel} · ${label}`
  // Default assignee: whoever last wrote this card, else the idea owner.
  const defaultAssignee = ctx.fieldAuthors[field] || ctx.ideaOwnerId || ''

  const startThread = async (kind: 'discussion' | 'revision_request', body: string, assigneeId: string | undefined, mentionIds: string[]) => {
    const thread = await ctx.threads.create({ kind, body, field_key: field, assignee_id: assigneeId ?? null })
    notifySectionThread(ctx.notifyContext, { kind: 'mention', sectionKey: ctx.sectionKey, targetLabel: target, threadId: thread.id, recipients: mentionIds, excerpt: plainText(body) })
    notifySectionThread(ctx.notifyContext, kind === 'revision_request'
      ? { kind: 'revision_requested', sectionKey: ctx.sectionKey, targetLabel: target, threadId: thread.id, recipients: [assigneeId ?? ''], excerpt: plainText(body) }
      : {
          kind: 'discussion_opened', sectionKey: ctx.sectionKey, targetLabel: target, threadId: thread.id, excerpt: plainText(body),
          // Mentioned people already got a 'mentioned you' notification.
          recipients: [...(ctx.notifyContext?.reviewerIds ?? []), ctx.fieldAuthors[field] ?? '', ctx.pending?.author_id ?? '']
            .filter((id) => !mentionIds.includes(id)),
        })
    setComposer(null)
  }

  const open = () => {
    setDraft(pendingIsOwn && pendingValue !== undefined ? pendingValue : value)
    setRequireChecker(pendingIsOwn ? Boolean((ctx.pending?.content_json?._review as FieldReview | undefined)?.require_checker) : false)
    setError(null)
    setInstruction('')
    setAiAssist(null)
    setEditing(true)
  }

  const suggest = async () => {
    setSuggesting(true)
    setError(null)
    try {
      const result = await suggestIdeaSummaryField({
        idea_id: ctx.ideaId, field: field as IdeaSummaryFieldKey, current_text: draft, instruction: instruction.trim(),
      })
      setAiAssist({ previous: aiAssist?.previous ?? draft, notes: result.notes, modelId: result.model_id ?? null, instruction: instruction.trim() })
      setDraft(result.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI could not provide a suggestion.')
    } finally {
      setSuggesting(false)
    }
  }

  const save = async () => {
    const next = draft.trim()
    if (!next) { setError(`${label} cannot be empty.`); return }
    setBusy(true)
    setError(null)
    try {
      // Continuing one's own pending edit folds it into the new revision, which
      // supersedes the old one on accept, so edits to several cards review as one.
      const fields = { ...(pendingIsOwn ? ctx.pendingFields : {}), [field]: next }
      const created = await createIdeaSectionRevision(ctx.ideaId, ctx.sectionKey, {
        source: 'human',
        content_json: { fields },
        base_revision_id: ctx.activeRevisionId,
        original_ai_text: ctx.currentContent,
        require_checker: requireChecker,
        ...(aiAssist ? {
          model_id: aiAssist.modelId,
          evidence_json: [{ type: 'ai_suggestion', field, instruction: aiAssist.instruction }],
        } : {}),
      })
      await transitionIdeaSectionRevision(ctx.ideaId, ctx.sectionKey, created.id, 'accept')
      notifySectionReview(ctx.notifyContext, {
        kind: 'submitted', sectionKey: ctx.sectionKey, sectionLabel: ctx.sectionLabel, revisionId: created.id,
        changedLabels: Object.keys(fields).filter((key) => fields[key as SummaryFieldKey] !== ctx.approvedFields[key as SummaryFieldKey])
          .map((key) => summaryFieldLabel(key)),
      })
      await ctx.refresh()
      dispatchIdeaSectionRevisionUpdated(ctx.ideaId, ctx.sectionKey)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    const muted = dark ? 'text-slate-400' : 'text-slate-500'
    return (
      <div className="space-y-3" data-summary-field-editor={field}>
        <Textarea
          autoFocus
          aria-label={`Edit ${label}`}
          value={draft}
          disabled={busy || suggesting}
          onChange={(e) => { setDraft(e.target.value); setError(null) }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !busy) setEditing(false)
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save()
          }}
          className={cn(
            'min-h-[120px] resize-y rounded-lg px-3 py-2.5 text-sm leading-6 shadow-none',
            dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-border/80 bg-background text-slate-800',
          )}
        />

        {/* AI assist: same control height as the drawers (h-10). Summary cards only:
            agent-runtime suggest-field knows the Summary card purposes. */}
        {ctx.sectionKey === 'summary' ? <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`AI instruction for ${label}`}
              placeholder="Instruction for AI (optional), e.g. make it more concise"
              value={instruction}
              maxLength={500}
              disabled={busy || suggesting}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void suggest() } }}
              className={cn(
                'h-10 min-w-[12rem] flex-1 rounded-lg px-3 text-sm',
                dark ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500' : 'bg-background',
              )}
            />
            <Button
              type="button"
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), dark && 'border-slate-600 bg-slate-900 text-slate-100 hover:!bg-slate-800 hover:!text-white')}
              disabled={busy || suggesting}
              onClick={() => void suggest()}
            >
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              Suggest AI
            </Button>
          </div>
          {aiAssist ? (
            <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', dark ? 'text-slate-300' : 'text-muted-foreground')} role="status">
              <span>AI draft{aiAssist.notes ? `: ${aiAssist.notes}` : '.'} Review it before saving.</span>
              <button type="button" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline" disabled={busy || suggesting}
                onClick={() => { setDraft(aiAssist.previous); setAiAssist(null) }}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restore my text
              </button>
            </div>
          ) : null}
        </div> : null}

        {error ? (
          <div role="alert" className={cn('flex gap-2 rounded-lg border px-3 py-2 text-xs', dark ? 'border-rose-400/40 bg-rose-950/40 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700')}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t pt-3', dark ? 'border-slate-700' : 'border-border/70')}>
          <div className="min-w-0 space-y-0.5">
            <label className={cn('flex items-center gap-2 text-sm', dark ? 'text-slate-200' : 'text-slate-700')}>
              <input type="checkbox" className="h-4 w-4" checked={requireChecker} disabled={busy} onChange={(e) => setRequireChecker(e.target.checked)} />
              Requires approval from another reviewer
            </label>
            <p className={cn('pl-6 text-xs', muted)}>Saved as pending approval.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), dark && 'border-slate-600 bg-slate-900 text-slate-100 hover:!bg-slate-800 hover:!text-white')}
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              <X className="h-4 w-4" aria-hidden /> Cancel
            </Button>
            <Button
              type="button"
              className={registerServicePrimaryButtonClass()}
              disabled={busy || suggesting || !draft.trim()}
              onClick={() => void save()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Save
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group/field relative">
      {/* Keep line breaks, so a card revised into a list reads as a list. */}
      <div className={cn(commentOnly ? 'pr-7' : 'pr-14', '[&_p]:whitespace-pre-line')}>{render(value)}</div>
      <CommentsHoverPopover
        openSignal={popoverSignal}
        title={<span>Comments · {label}{fieldThreads.length ? <span className="ml-1 font-normal text-slate-500">({fieldThreads.length} open)</span> : null}</span>}
        renderTrigger={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label={`Discussion on ${label}`}
            className={cn(
              commentOnly ? 'right-0' : 'right-7',
              'absolute top-0 inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-semibold transition focus-visible:opacity-100 group-hover/field:opacity-100',
              fieldThreads.length || triggerProps['aria-expanded'] ? 'opacity-100' : 'opacity-0',
              dark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-white/80 hover:text-slate-900',
            )}
          >
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
            {fieldThreads.length ? <span>{fieldThreads.length}</span> : null}
          </button>
        )}
      >
        {fieldThreads.length === 0 && !composer ? (
          <p className="text-xs text-slate-500">No comments yet. Start a discussion or request a revision.</p>
        ) : null}
        {fieldThreads.map((thread) => (
          <ThreadView
            key={thread.id}
            thread={thread}
            nameOf={ctx.displayName}
            currentUserId={ctx.userId}
            people={ctx.people}
            onRevise={blockedByOther ? undefined : open}
            onReply={async (body, mentionIds) => {
              await ctx.threads.reply(thread.id, body)
              notifySectionThread(ctx.notifyContext, { kind: 'mention', sectionKey: ctx.sectionKey, targetLabel: target, threadId: thread.id, recipients: mentionIds, excerpt: plainText(body) })
              notifySectionThread(ctx.notifyContext, {
                kind: 'reply', sectionKey: ctx.sectionKey, targetLabel: target, threadId: thread.id, excerpt: plainText(body),
                recipients: threadParticipants(thread).filter((id) => !mentionIds.includes(id)),
              })
            }}
            onClose={async () => {
              await ctx.threads.close(thread.id)
              notifySectionThread(ctx.notifyContext, { kind: 'thread_closed', sectionKey: ctx.sectionKey, targetLabel: target, threadId: thread.id, recipients: threadParticipants(thread) })
            }}
          />
        ))}
        {composer ? (
          <ThreadComposer
            kind={composer}
            people={ctx.people}
            defaultAssignee={defaultAssignee}
            onSubmit={(body, assigneeId, mentionIds) => startThread(composer, body, assigneeId, mentionIds)}
            onCancel={() => setComposer(null)}
          />
        ) : (
          <div className="flex w-full items-stretch gap-2 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-3">
            <Button type="button" variant="outline" onClick={() => setComposer('discussion')} className={cn(enterpriseSecondaryButtonClass(), REVIEW_ACTION_TONE.soft)}>
              <MessagesSquare className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">Start discussion</span>
            </Button>
            {openRequest || commentOnly ? null : (
              <Button type="button" variant="outline" onClick={() => setComposer('revision_request')} className={cn(enterpriseSecondaryButtonClass(), REVIEW_ACTION_TONE.outline)}>
                <MessageSquarePlus className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">Request revision</span>
              </Button>
            )}
          </div>
        )}
        {ctx.threads.error ? <p role="alert" className="text-xs text-rose-700">{ctx.threads.error}</p> : null}
      </CommentsHoverPopover>
      {commentOnly ? null : <button
        type="button"
        aria-label={`Edit ${label}`}
        title={blockedByOther
          ? needsRevision
            ? `${ctx.displayName(pendingAuthor)}'s change is being revised by its author.`
            : `${ctx.displayName(pendingAuthor)}'s change is awaiting approval. Approve or reject it first in Version history.`
          : `Edit ${label}`}
        disabled={blockedByOther}
        onClick={open}
        className={cn(
          'absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 group-hover/field:opacity-100 disabled:cursor-not-allowed disabled:opacity-40',
          dark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-white/80 hover:text-slate-900',
        )}
      >
        <PencilLine className="h-3.5 w-3.5" aria-hidden />
      </button>}
      {editedBy ? (
        <p className={cn('mt-1.5 text-[11px] font-medium', dark ? 'text-emerald-300' : 'text-emerald-700')}>Edited by {editedBy}</p>
      ) : null}
      {hasPendingChange && needsRevision ? (
        <div className={cn('mt-2 rounded-lg border px-3 py-2 text-xs', dark ? 'border-amber-400/40 bg-amber-950/40 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900')}
          role="status" aria-label="Changes requested">
          <p className="flex items-center gap-1 font-semibold">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            {ctx.revisionRequest ? `${ctx.displayName(ctx.revisionRequest.authorId)} requested changes` : 'Changes requested'}
            {pendingIsOwn ? null : ` to ${ctx.displayName(pendingAuthor)}'s edit`}
          </p>
          {ctx.revisionRequest ? <p className="mt-1 whitespace-pre-wrap break-words">"{ctx.revisionRequest.body}"</p> : null}
          {pendingIsOwn ? (
            <Button type="button" size="sm" variant="outline" className="mt-2 h-7 gap-1 px-2 text-xs" onClick={open}>
              <PencilLine className="h-3.5 w-3.5" aria-hidden /> Revise
            </Button>
          ) : null}
        </div>
      ) : hasPendingChange ? (
        <p className={cn('mt-1.5 flex items-center gap-1 text-[11px] font-medium', dark ? 'text-amber-300' : 'text-amber-700')}>
          <Clock3 className="h-3 w-3" aria-hidden />
          Change by {ctx.displayName(pendingAuthor)} awaiting approval
        </p>
      ) : null}
      {openRequest ? (
        <button type="button" onClick={() => setPopoverSignal((n) => n + 1)} aria-label="Revision requested"
          className={cn('mt-2 block w-full rounded-lg border px-3 py-2 text-left text-xs', dark ? 'border-amber-400/40 bg-amber-950/40 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900')}>
          <span className="flex items-center gap-1 font-semibold">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            Revision requested by {ctx.displayName(openRequest.created_by)} · assigned to {ctx.displayName(openRequest.assignee_id ?? '')}
          </span>
          <span className="mt-1 line-clamp-2 block whitespace-pre-wrap break-words">"{openRequest.comments[0]?.body}"</span>
        </button>
      ) : null}
    </div>
  )
}
