import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Loader2, Quote, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PartCommentAccess, PartCommentThread } from '@/lib/api/tectonaAgentRuntimeApi'
import { fetchMicrosoftProfilePhoto } from '@/lib/api/microsoftGraphApi'
import { cn } from '@/lib/utils'
import {
  CommentBody,
  MentionTextarea,
  encodeMentions,
  plainText,
  type ThreadPerson,
} from '@/modules/project-management/components/IdeaSectionThreads'
import type { PartAnchors } from '@/modules/project-management/components/TemplateDocumentPreview'
import { partTakesComments, type TemplatePart } from '@/modules/project-management/lib/templatePartSelection'

const CARD_GAP = 10

/** The id the comment boxes use for Tectona in mention markup (agent-runtime part_comment_people.py). */
export const TECTONA_MENTION: ThreadPerson = { id: 'tectona', name: 'Tectona' }

/** Whether a comment asks Tectona for a proposal (only then Tectona answers). */
export function asksTectona(text: string): boolean {
  return /@\[[^\]\n]{1,80}\]\(tectona\)/i.test(text) || /(^|[^\w@])@tectona\b/i.test(text)
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? '?').slice(0, 2)).toUpperCase()
}

function when(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })
}

const EVENT_TEXT: Record<string, string> = {
  accept: 'accepted the proposal',
  discard: 'discarded the proposal',
  reopen: 'reopened the proposal',
  applied: 'The accepted text is in the generated version.',
}

function Avatar({ name, tectona = false, photoUrl }: { name: string; tectona?: boolean; photoUrl?: string | null }) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        tectona ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground',
      )}
    >
      {tectona ? <Sparkles className="h-3.5 w-3.5" /> : photoUrl && photoUrl !== failedPhotoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailedPhotoUrl(photoUrl)}
        />
      ) : initials(name)}
    </span>
  )
}

function Composer({
  placeholder,
  people,
  busy,
  error,
  autoFocus,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  placeholder: string
  people: ThreadPerson[]
  busy: boolean
  error: string
  autoFocus?: boolean
  submitLabel: string
  onCancel?: () => void
  /** Gets the comment with mentions as @[Name](id) markup; resolves true when it was posted. */
  onSubmit: (text: string) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<ThreadPerson[]>([])
  const submit = async () => {
    if (!text.trim() || busy) return
    if (await onSubmit(encodeMentions(text.trim(), picked))) {
      setText('')
      setPicked([])
    }
  }
  return (
    <div className="space-y-1.5">
      <MentionTextarea
        autoFocus={autoFocus}
        rows={2}
        value={text}
        disabled={busy}
        people={people}
        picked={picked}
        onPick={(person) => setPicked((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]))}
        onChange={setText}
        onSubmitShortcut={() => void submit()}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-[56px] w-full resize-y rounded-lg text-xs"
      />
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] leading-4 text-muted-foreground">@Tectona for a proposal · Ctrl+Enter to post</span>
        <div className="flex items-center gap-1.5">
          {onCancel ? (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="button" size="sm" className="h-7 px-2.5 text-xs" disabled={busy || !text.trim()} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Comments beside the document preview, like Word's: one thread per part, at the height of the part.
 * A comment that mentions @Tectona asks it to change the part; Tectona answers with a proposal
 * grounded in the source context, which the idea owner or the thread's creator accepts (written as
 * is when generating) or discards. Other mentions bring people into the discussion.
 */
export function PartCommentRail({
  anchors,
  parts,
  threads,
  selectedKey,
  onSelect,
  currentUserName,
  currentUserId,
  people,
  access,
  accessLoading = false,
  disabled,
  onPost,
  onResolve,
}: {
  anchors: PartAnchors
  parts: TemplatePart[]
  threads: PartCommentThread[]
  selectedKey: string | null
  onSelect: (key: string) => void
  currentUserName: string
  currentUserId: string
  /** Who can be mentioned (Tectona first). */
  people: ThreadPerson[]
  /** What the current user may do; null while it loads (nothing is offered then). */
  access: PartCommentAccess | null
  accessLoading?: boolean
  disabled: boolean
  /** Posts a comment; resolves false when the user stepped back (nothing posted); rejects with a readable error. */
  onPost: (part: TemplatePart, message: string, thread?: PartCommentThread) => Promise<boolean>
  onResolve: (thread: PartCommentThread, action: 'accept' | 'discard' | 'reopen') => Promise<void>
}) {
  const [dismissedComposer, setDismissedComposer] = useState<string | null>(null)
  const [currentUserPhotoUrl, setCurrentUserPhotoUrl] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [errorKey, setErrorKey] = useState<{ key: string; message: string } | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let objectUrl: string | null = null
    void fetchMicrosoftProfilePhoto(controller.signal)
      .then((photo) => {
        if (!active || !photo) return
        objectUrl = URL.createObjectURL(photo)
        setCurrentUserPhotoUrl(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])
  // A composer closed with Cancel comes back when another part is selected.
  useEffect(() => {
    setDismissedComposer((prev) => (prev === selectedKey ? prev : null))
  }, [selectedKey])

  const partByKey = useMemo(() => new Map(parts.map((part) => [part.key, part])), [parts])
  const threadByPart = useMemo(() => new Map(threads.map((thread) => [thread.part_key, thread])), [threads])
  const selectedPart = selectedKey ? partByKey.get(selectedKey) : undefined

  // Cards: every thread that is not discarded, the selected part's (any status), and a new-comment
  // card for a selected part without a thread.
  const cards = useMemo(() => {
    const keys = new Set<string>()
    for (const thread of threads) {
      if (thread.status !== 'discarded' || thread.part_key === selectedKey) keys.add(thread.part_key)
    }
    if (selectedKey && selectedKey !== dismissedComposer) keys.add(selectedKey)
    return Array.from(keys)
      .filter((key) => anchors[key] !== undefined)
      .sort((a, b) => anchors[a] - anchors[b])
  }, [anchors, dismissedComposer, selectedKey, threads])

  // Word-like stacking: each card at its part's height, pushed down when the one above is in the way.
  useLayoutEffect(() => {
    let bottom = -Infinity
    for (const key of cards) {
      const el = cardRefs.current.get(key)
      if (!el) continue
      const top = Math.max(anchors[key] ?? 0, bottom + CARD_GAP)
      el.style.top = `${top}px`
      bottom = top + el.offsetHeight
    }
  })

  const canComment = Boolean(access?.can_comment)
  const mayDecide = (thread: PartCommentThread) =>
    Boolean(access?.is_owner) || (Boolean(currentUserId) && thread.created_by === currentUserId)

  const post = async (part: TemplatePart, text: string, thread?: PartCommentThread): Promise<boolean> => {
    setPendingKey(part.key)
    setPendingText(text)
    setErrorKey(null)
    try {
      return await onPost(part, text, thread)
    } catch (error) {
      setErrorKey({ key: part.key, message: error instanceof Error ? error.message : "Couldn't draft a proposal. Try again." })
      return false
    } finally {
      setPendingKey(null)
      setPendingText('')
    }
  }

  const resolve = async (thread: PartCommentThread, action: 'accept' | 'discard' | 'reopen') => {
    setResolving(thread.id)
    setErrorKey(null)
    try {
      await onResolve(thread, action)
    } catch (error) {
      setErrorKey({ key: thread.part_key, message: error instanceof Error ? error.message : "Couldn't save that. Try again." })
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="relative h-full" aria-label="Comments">
      {cards.map((key) => {
        const part = partByKey.get(key)
        if (!part) return null
        const thread = threadByPart.get(key)
        const selected = key === selectedKey
        const pending = pendingKey === key
        const error = errorKey?.key === key ? errorKey.message : ''
        const latestAssistant = thread ? [...thread.messages].reverse().find((m) => m.role === 'assistant') : undefined
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) cardRefs.current.set(key, el)
              else cardRefs.current.delete(key)
            }}
            className={cn(
              'absolute inset-x-0 rounded-2xl border bg-background p-3 text-xs shadow-sm transition-[top,box-shadow]',
              selected ? 'z-10 border-primary/40 shadow-md' : 'border-border/80 opacity-90 hover:opacity-100',
            )}
            onClick={() => {
              if (!selected) onSelect(key)
            }}
          >
            {!thread ? (
              !partTakesComments(part) ? (
                <p className="text-muted-foreground">Comments on table parts aren't available yet.</p>
              ) : !canComment ? (
                <p className="text-muted-foreground">
                  {accessLoading ? 'Loading comments…' : access === null ? "Comments aren't available right now." : access.can_read
                    ? 'You can read this discussion. The idea owner can let you reply.'
                    : "You don't have access to this idea's comments. The idea owner can let you in."}
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={currentUserName} photoUrl={currentUserPhotoUrl} />
                    <span className="font-medium text-foreground">{currentUserName}</span>
                  </div>
                  {pending ? (
                    <PendingComment text={pendingText} author={currentUserName} />
                  ) : (
                    <Composer
                      autoFocus
                      placeholder={`Comment on ${part.label}, @ to mention`}
                      people={people}
                      submitLabel="Comment"
                      busy={disabled || pending}
                      error={error}
                      onCancel={() => setDismissedComposer(key)}
                      onSubmit={(text) => post(part, text)}
                    />
                  )}
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-foreground" title={thread.part_label}>{thread.part_label || part.label}</span>
                  <StatusChip status={thread.status} discussion={!thread.proposal} />
                </div>
                {selected ? (
                  <>
                    {thread.messages.map((message, index) => {
                      if (message.role === 'event') {
                        return (
                          <p key={index} className="text-[11px] text-muted-foreground">
                            {message.text === 'applied' ? EVENT_TEXT.applied : `${message.author_name || 'Someone'} ${EVENT_TEXT[message.text] ?? message.text}`}
                            {message.created_at ? ` · ${when(message.created_at)}` : ''}
                          </p>
                        )
                      }
                      const isTectona = message.role === 'assistant'
                      const name = isTectona ? 'Tectona' : message.author_name || 'Reviewer'
                      const isLatest = message === latestAssistant
                      return (
                        <div key={index} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={name} tectona={isTectona} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{name}</p>
                              {message.created_at ? <p className="text-[10px] text-muted-foreground">{when(message.created_at)}</p> : null}
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap leading-5 text-foreground/90"><CommentBody body={message.text} /></p>
                          {isTectona && message.proposal ? (
                            <div className={cn('space-y-1.5 rounded-lg border px-2.5 py-2', isLatest ? 'border-sky-200 bg-sky-50/60 dark:border-sky-500/30 dark:bg-sky-500/10' : 'border-border/70 bg-muted/20 opacity-80')}>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{isLatest ? 'Proposed text' : 'Earlier proposal'}</p>
                              <p className="whitespace-pre-wrap leading-5 text-foreground">{message.proposal.value}</p>
                              {message.proposal.source_quotes.length > 0 ? (
                                <ul className="space-y-0.5">
                                  {message.proposal.source_quotes.map((quote) => (
                                    <li key={quote} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                                      <Quote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                      <span>From the source: “{quote}”</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              {message.proposal.user_facts.length > 0 ? (
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                  <p className="font-medium">Not in the source, from your comment:</p>
                                  <ul className="list-disc pl-4">
                                    {message.proposal.user_facts.map((fact) => <li key={fact}>{fact}</li>)}
                                  </ul>
                                  <p className="mt-0.5">Accepting records it as reviewer input for this idea's documents.</p>
                                </div>
                              ) : null}
                              {isLatest && thread.status === 'open' && mayDecide(thread) ? (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                    disabled={disabled || resolving === thread.id}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void resolve(thread, 'accept')
                                    }}
                                  >
                                    {resolving === thread.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : <Check className="mr-1 h-3 w-3" aria-hidden />}
                                    Accept
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    disabled={disabled || resolving === thread.id}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void resolve(thread, 'discard')
                                    }}
                                  >
                                    <X className="mr-1 h-3 w-3" aria-hidden />
                                    Discard
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                    {thread.status === 'accepted' ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                        <span>Accepted · written as is when you generate.</span>
                        {mayDecide(thread) ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium hover:underline disabled:opacity-50"
                          disabled={disabled || resolving === thread.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            void resolve(thread, 'reopen')
                          }}
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden />
                          Undo
                        </button>
                        ) : null}
                      </div>
                    ) : null}
                    {pending ? <PendingComment text={pendingText} author={currentUserName} /> : null}
                    {partTakesComments(part) && !pending && canComment ? (
                      <Composer
                        placeholder="Reply, @ to mention"
                        people={people}
                        submitLabel="Reply"
                        busy={disabled}
                        error={error}
                        onSubmit={(text) => post(part, text, thread)}
                      />
                    ) : null}
                    {!canComment && access?.can_read ? (
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Eye className="h-3 w-3" aria-hidden />
                        Read only. The idea owner can let you reply.
                      </p>
                    ) : null}
                    {error && !canComment ? <p className="text-[11px] text-destructive">{error}</p> : null}
                  </>
                ) : (
                  <p className="line-clamp-2 leading-5 text-muted-foreground">
                    {thread.status === 'accepted' || thread.status === 'applied'
                      ? thread.accepted_value
                      : latestAssistant?.proposal?.value
                        ?? plainText([...thread.messages].reverse().find((m) => m.role !== 'event')?.text ?? '')}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
      {selectedPart && anchors[selectedPart.key] === undefined ? (
        <p className="sticky top-0 rounded-xl border border-border/70 bg-background p-3 text-xs text-muted-foreground">
          “{selectedPart.label}” isn't marked in this document, so it can't be commented on here.
        </p>
      ) : null}
    </div>
  )
}

function StatusChip({ status, discussion }: { status: PartCommentThread['status']; discussion: boolean }) {
  // A thread nobody asked Tectona in is a discussion between people, not a proposal.
  const label = status === 'open' && discussion
    ? 'Discussion'
    : { open: 'Proposal', accepted: 'Accepted', applied: 'Applied', discarded: 'Discarded' }[status]
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        status === 'open' && (discussion ? 'bg-muted text-foreground' : 'bg-sky-100 text-sky-800'),
        status === 'accepted' && 'bg-emerald-100 text-emerald-800',
        status === 'applied' && 'bg-muted text-muted-foreground',
        status === 'discarded' && 'bg-muted text-muted-foreground line-through',
      )}
    >
      {label}
    </span>
  )
}

function PendingComment({ text, author }: { text: string; author: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Avatar name={author} />
        <span className="font-medium text-foreground">{author}</span>
      </div>
      <p className="whitespace-pre-wrap leading-5 text-foreground/90"><CommentBody body={text} /></p>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {asksTectona(text) ? 'Tectona is drafting a proposal from the source context…' : 'Posting…'}
      </p>
    </div>
  )
}
