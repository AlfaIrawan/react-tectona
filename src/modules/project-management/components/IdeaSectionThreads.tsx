import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, MessageSquarePlus, MessagesSquare, PencilLine, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  closeIdeaSectionThread,
  createIdeaSectionThread,
  listIdeaSectionThreads,
  replyToIdeaSectionThread,
  type IdeaSectionKey,
  type IdeaSectionThreadApi,
  type IdeaSectionThreadKind,
} from '@/lib/api/ideaBacklogApi'
import { IDEA_SECTION_REVISION_UPDATED_EVENT } from '@/lib/chat/ideaSectionRevisionFromChat'
import { cn } from '@/lib/utils'
import { getUiLayoutViewportSize, visualRectToLayoutRect } from '@/lib/uiScale'

export const IDEA_SECTION_THREADS_UPDATED_EVENT = 'tectona:idea-section-threads-updated'

export type ThreadPerson = { id: string; name: string }

function dispatchThreadsUpdated(ideaId: string, sectionKey: string) {
  window.dispatchEvent(new CustomEvent(IDEA_SECTION_THREADS_UPDATED_EVENT, { detail: { ideaId, sectionKey } }))
}

/**
 * Open threads of one section, kept in sync across every place that shows them
 * (cards, Version history, header badge). Approving a revision can close
 * revision requests server-side, so revision updates refresh threads too.
 */
export function useSectionThreads(ideaId: string, sectionKey: IdeaSectionKey) {
  const [threads, setThreads] = useState<IdeaSectionThreadApi[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setThreads(await listIdeaSectionThreads(ideaId, sectionKey))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Threads could not be loaded.')
    }
  }, [ideaId, sectionKey])

  useEffect(() => {
    setThreads([])
    void refresh()
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.ideaId === ideaId && detail?.sectionKey === sectionKey) void refresh()
    }
    window.addEventListener(IDEA_SECTION_THREADS_UPDATED_EVENT, onUpdate)
    window.addEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate)
    return () => {
      window.removeEventListener(IDEA_SECTION_THREADS_UPDATED_EVENT, onUpdate)
      window.removeEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate)
    }
  }, [ideaId, sectionKey, refresh])

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    const result = await action()
    dispatchThreadsUpdated(ideaId, sectionKey)
    return result
  }, [ideaId, sectionKey])

  return {
    threads,
    error,
    refresh,
    create: (body: { kind: IdeaSectionThreadKind; body: string; field_key?: string | null; revision_id?: string | null; assignee_id?: string | null }) =>
      run(() => createIdeaSectionThread(ideaId, sectionKey, body)),
    reply: (threadId: string, body: string) => run(() => replyToIdeaSectionThread(ideaId, sectionKey, threadId, body)),
    close: (threadId: string) => run(() => closeIdeaSectionThread(ideaId, sectionKey, threadId)),
  }
}

export type SectionThreadsApi = ReturnType<typeof useSectionThreads>

/** Everyone who took part in a thread, for reply notifications. */
export function threadParticipants(thread: IdeaSectionThreadApi): string[] {
  return [thread.created_by, thread.assignee_id ?? '', ...thread.comments.map((c) => c.author_id)].filter(Boolean)
}

export function ThreadView({ thread, nameOf, currentUserId, people = [], onReply, onClose, onRevise, compact = false }: {
  thread: IdeaSectionThreadApi
  nameOf: (id: string) => string
  currentUserId?: string | null
  /** Members that can be @mentioned in a reply. */
  people?: ThreadPerson[]
  /** body is stored markup; mentionIds are the people mentioned in it. */
  onReply: (body: string, mentionIds: string[]) => Promise<void>
  onClose: () => Promise<void>
  /** Shown to the assignee of an open revision request. */
  onRevise?: () => void
  compact?: boolean
}) {
  const [reply, setReply] = useState('')
  const [picked, setPicked] = useState<ThreadPerson[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRequest = thread.kind === 'revision_request'
  const open = thread.status === 'open'
  const sendReply = () => {
    if (!reply.trim()) return
    void act(async () => {
      const body = encodeMentions(reply.trim(), picked)
      await onReply(body, mentionIdsOf(body))
      setReply('')
      setPicked([])
    })
  }
  const isAssignee = Boolean(currentUserId && thread.assignee_id === currentUserId)
  // The server also lets reviewers cancel a request; the UI offers it to the requester.
  const canClose = open && (!isRequest || thread.created_by === currentUserId)

  const act = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.') } finally { setBusy(false) }
  }

  return (
    <div
      className={cn('rounded-lg border p-3 text-xs', isRequest ? 'border-amber-200 bg-amber-50/70' : 'border-border bg-background/80')}
      data-thread-id={thread.id}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('font-semibold', isRequest ? 'text-amber-900' : 'text-foreground')}>
          {isRequest
            ? <>Revision requested · assigned to {nameOf(thread.assignee_id ?? '')}</>
            : 'Discussion'}
          {open ? null : <span className="ml-1 font-normal text-muted-foreground">({thread.status})</span>}
        </p>
        {canClose ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={busy} onClick={() => void act(onClose)}>
            {isRequest ? <X className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
            {isRequest ? 'Cancel request' : 'Resolve'}
          </Button>
        ) : null}
      </div>
      <ul className={cn('mt-2 space-y-2', compact && 'space-y-1.5')}>
        {thread.comments.map((comment) => (
          <li key={comment.id}>
            <p className="text-[11px] text-muted-foreground">{nameOf(comment.author_id)} · {new Date(comment.created_at).toLocaleString()}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground"><CommentBody body={comment.body} /></p>
          </li>
        ))}
      </ul>
      {open && isRequest && isAssignee && onRevise ? (
        <Button type="button" size="sm" variant="outline" className="mt-2 h-7 gap-1 px-2 text-xs" onClick={onRevise}>
          <PencilLine className="h-3.5 w-3.5" aria-hidden /> Revise
        </Button>
      ) : null}
      {open ? (
        <div className="mt-2 flex items-start gap-2">
          <MentionTextarea
            rows={1}
            aria-label="Reply"
            value={reply}
            onChange={setReply}
            people={people}
            picked={picked}
            onPick={(person) => setPicked((prev) => [...prev, person])}
            onSubmitShortcut={sendReply}
            disabled={busy}
            placeholder="Reply… type @ to mention someone"
            className="h-10 min-h-10 resize-none rounded-lg bg-background py-2.5 text-xs leading-4"
          />
          <Button type="button" variant="outline" disabled={busy || !reply.trim()} onClick={sendReply}
            className="h-10 shrink-0 gap-1.5 rounded-lg border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />} Reply
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-rose-700">{error}</p> : null}
    </div>
  )
}

export function ThreadComposer({ kind, people, defaultAssignee, onSubmit, onCancel }: {
  kind: IdeaSectionThreadKind
  people: ThreadPerson[]
  defaultAssignee?: string
  onSubmit: (body: string, assigneeId: string | undefined, mentionIds: string[]) => Promise<void>
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  const [picked, setPicked] = useState<ThreadPerson[]>([])
  const [assignee, setAssignee] = useState(defaultAssignee ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRequest = kind === 'revision_request'
  // Keep the default visible even if the directory has not loaded that person.
  const options = assignee && !people.some((p) => p.id === assignee) ? [{ id: assignee, name: assignee }, ...people] : people

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const encoded = encodeMentions(body.trim(), picked)
      await onSubmit(encoded, isRequest ? assignee : undefined, mentionIdsOf(encoded))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
      <label className="block font-semibold text-foreground" htmlFor={`thread-composer-${kind}`}>
        {isRequest ? 'What should be revised?' : 'Start a discussion'}
      </label>
      <MentionTextarea
        id={`thread-composer-${kind}`}
        autoFocus
        value={body}
        disabled={busy}
        onChange={setBody}
        people={people}
        picked={picked}
        onPick={(person) => setPicked((prev) => [...prev, person])}
        onSubmitShortcut={() => { if (body.trim()) void submit() }}
        placeholder={isRequest ? 'e.g. Add a measurable SLA target for escalations. Type @ to mention.' : 'e.g. Has this SLA figure been confirmed? Type @ to mention.'}
        className="min-h-[80px] resize-y rounded-lg bg-background text-sm"
      />
      {isRequest ? (
        <label className="flex items-center gap-2 text-foreground">
          <span className="shrink-0 font-medium">Assign to</span>
          <select
            aria-label="Assign revision to"
            value={assignee}
            disabled={busy}
            onChange={(e) => setAssignee(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="" disabled>Choose a person</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      ) : null}
      {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={busy || !body.trim() || (isRequest && !assignee)} onClick={() => void submit()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : isRequest ? <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden /> : <MessagesSquare className="h-3.5 w-3.5" aria-hidden />}
          {isRequest ? 'Send request' : 'Post'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// @mentions. A comment stores a mention as "@[Name](subject-id)" so the name
// renders as a chip and the id drives the notification; the textarea shows
// plain "@Name" while typing.
// ---------------------------------------------------------------------------

const MENTION_MARKUP_RE = /@\[([^\]\n]{1,80})\]\(([^)\s]{1,100})\)/g
// The query may contain spaces ("@Ricky G") but not a line break or another @.
const MENTION_QUERY_RE = /(^|\s)@([^\n@]{0,40})$/
const MENTION_SUGGESTION_LIMIT = 6

/** A stored body as plain text ("@Name"), for notification excerpts. */
export function plainText(body: string): string {
  return body.replace(MENTION_MARKUP_RE, (_m, name: string) => `@${name}`)
}

/** Subject ids mentioned in a stored comment body. */
export function mentionIdsOf(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION_MARKUP_RE)].map((m) => m[2]))]
}

/** Turn the "@Name" tokens the user picked into stored mention markup. */
export function encodeMentions(text: string, picked: ThreadPerson[]): string {
  // Longest names first, so "@Alfa Irawan" is not consumed as "@Alfa".
  const people = [...new Map(picked.map((p) => [p.id, p])).values()].sort((a, b) => b.name.length - a.name.length)
  let out = text
  for (const person of people) {
    const token = `@${person.name}`
    out = out.split(token).join(`@[${person.name}](${person.id})`)
  }
  return out
}

// The theme accent (follows data-accent), not a hard-coded hue.
const MENTION_CHIP_CLASS = 'rounded-sm bg-primary/10 text-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.10)]'

/** Colour the picked "@Name" tokens in the text being typed (mirror layer). */
function highlightMentions(text: string, picked: ThreadPerson[]): ReactNode[] {
  const names = [...new Set(picked.map((p) => p.name))].sort((a, b) => b.length - a.length)
  if (!names.length) return [text]
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`@(?:${escaped.join('|')})`, 'g')
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    parts.push(<span key={index} className={MENTION_CHIP_CLASS}>{match[0]}</span>)
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Render a stored body with mentions as chips. */
export function CommentBody({ body }: { body: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of body.matchAll(MENTION_MARKUP_RE)) {
    const index = match.index ?? 0
    if (index > last) parts.push(body.slice(last, index))
    parts.push(
      <span key={`${index}-${match[2]}`} className={MENTION_CHIP_CLASS} data-mention={match[2]}>
        @{match[1]}
      </span>,
    )
    last = index + match[0].length
  }
  if (last < body.length) parts.push(body.slice(last))
  return <>{parts}</>
}

/**
 * Textarea with "@" member suggestions. Reports the text plus the people picked
 * so the caller can encode them with encodeMentions on submit.
 */
export function MentionTextarea({ value, onChange, people, picked, onPick, onSubmitShortcut, className, ...rest }: {
  value: string
  onChange: (value: string) => void
  people: ThreadPerson[]
  picked: ThreadPerson[]
  onPick: (person: ThreadPerson) => void
  onSubmitShortcut?: () => void
  className?: string
  id?: string
  rows?: number
  autoFocus?: boolean
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)

  // Names with a word starting with the query come first ("Ri" → Ricky before Indriyaty).
  const q = (query ?? '').toLowerCase()
  const rank = (name: string) => (name.toLowerCase().split(/\s+/).some((word) => word.startsWith(q)) ? 0 : 1)
  const suggestions = query === null ? [] : people
    .filter((p) => p.name.toLowerCase().includes(q))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .slice(0, MENTION_SUGGESTION_LIMIT)

  const detect = (text: string, caret: number) => {
    const match = MENTION_QUERY_RE.exec(text.slice(0, caret))
    const candidate = match ? match[2] : null
    // Past the first space the query only stays open while it still matches a
    // member, so ordinary text after an @word is not treated as a mention.
    const stillMatches = candidate !== null && (!/\s/.test(candidate)
      || people.some((p) => p.name.toLowerCase().startsWith(candidate.toLowerCase())))
    setQuery(stillMatches ? candidate : null)
    setActive(0)
  }

  const pick = (person: ThreadPerson) => {
    const el = ref.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(MENTION_QUERY_RE, (_m, lead: string) => `${lead}@${person.name} `)
    const next = before + value.slice(caret)
    onChange(next)
    onPick(person)
    setQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(before.length, before.length)
    })
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="relative">
      {/* Mirror of the text behind a transparent textarea, so picked mentions can
          be coloured while typing. Same box metrics as the textarea; mention
          styling uses colour and box-shadow only, never padding, so the two
          layers stay aligned character for character. */}
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          'w-full rounded-md border border-input px-3 py-2 text-sm', className,
          'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-transparent !bg-background text-foreground',
        )}
      >
        {highlightMentions(value, picked)}
        {'\u200b'}
      </div>
      <Textarea
        {...rest}
        ref={ref}
        value={value}
        maxLength={2000}
        className={cn(className, 'relative !bg-transparent text-transparent caret-slate-900 dark:caret-slate-100')}
        onScroll={(e) => { if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop }}
        onChange={(e) => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart ?? e.target.value.length) }}
        onClick={(e) => detect(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
        onKeyDown={(e) => {
          if (suggestions.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + suggestions.length) % suggestions.length); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(suggestions[active]); return }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQuery(null); return }
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmitShortcut?.()
        }}
      />
      </div>
      {suggestions.length ? (
        // Inline (not floating) so the scrolling popover can never clip it.
        <ul role="listbox" aria-label="Mention a member" className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {suggestions.map((person, index) => (
            <li key={person.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(person) }}
                onMouseEnter={() => setActive(index)}
                className={cn('flex w-full items-center gap-2 px-2.5 py-1.5 text-left', index === active ? 'bg-primary/10 text-foreground' : 'text-foreground')}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                  {person.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{person.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : query !== null && people.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Member list is not available.</p>
      ) : null}
      {picked.length ? <span className="sr-only">Mentioned: {picked.map((p) => p.name).join(', ')}</span> : null}
    </div>
  )
}

type HoverPopoverTriggerProps = {
  ref: (node: HTMLButtonElement | null) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  'aria-expanded': boolean
  'aria-haspopup': 'dialog'
}

const POPOVER_OPEN_DELAY_MS = 120
const POPOVER_CLOSE_DELAY_MS = 220
const POPOVER_GAP = 8
const POPOVER_EDGE = 8

/**
 * Comment popover for a card: opens on hover of its trigger and stays open
 * while the pointer is over it. Clicking the trigger, focusing inside (typing a
 * reply) or `openSignal` pins it, so it never closes mid-reply; Escape, the
 * close button or a click outside unpin and close it. Rendered in a portal with
 * layout-space coordinates so it is not clipped by the card and follows the UI
 * scale (see components/ui/tooltip.tsx).
 */
export function CommentsHoverPopover({ renderTrigger, title, openSignal = 0, width = 380, children }: {
  renderTrigger: (props: HoverPopoverTriggerProps) => ReactNode
  title: ReactNode
  /** Increment to open and pin the popover (e.g. from a banner click or a deep link). */
  openSignal?: number
  width?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState<{ left: number; top: number; maxHeight: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const timer = useRef<number | null>(null)

  const clearTimer = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null } }
  const close = useCallback(() => { clearTimer(); setOpen(false); setPinned(false) }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = visualRectToLayoutRect(trigger.getBoundingClientRect())
    const viewport = getUiLayoutViewportSize()
    const height = popoverRef.current ? visualRectToLayoutRect(popoverRef.current.getBoundingClientRect()).height : 0
    // Right-aligned under the trigger; flip above when there is more room there.
    const left = Math.max(POPOVER_EDGE, Math.min(rect.right - width, viewport.width - width - POPOVER_EDGE))
    const below = viewport.height - rect.bottom - POPOVER_GAP - POPOVER_EDGE
    const above = rect.top - POPOVER_GAP - POPOVER_EDGE
    const placeAbove = height > below && above > below
    const maxHeight = Math.max(160, Math.min(460, placeAbove ? above : below))
    const top = placeAbove ? rect.top - POPOVER_GAP - Math.min(height, maxHeight) : rect.bottom + POPOVER_GAP
    setCoords({ left, top, maxHeight })
  }, [width])

  useEffect(() => {
    if (!openSignal) return
    clearTimer()
    setOpen(true)
    setPinned(true)
  }, [openSignal])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const frame = requestAnimationFrame(updatePosition) // again once the content has a height
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, updatePosition, close])

  useEffect(() => clearTimer, [])

  const scheduleOpen = () => {
    clearTimer()
    if (!open) timer.current = window.setTimeout(() => setOpen(true), POPOVER_OPEN_DELAY_MS)
  }
  const scheduleClose = () => {
    clearTimer()
    if (pinned) return
    timer.current = window.setTimeout(() => {
      // Keep it open while the user is typing in it.
      if (popoverRef.current?.contains(document.activeElement)) return
      setOpen(false)
    }, POPOVER_CLOSE_DELAY_MS)
  }

  return (
    <>
      {renderTrigger({
        ref: (node) => { triggerRef.current = node },
        onMouseEnter: scheduleOpen,
        onMouseLeave: scheduleClose,
        onClick: () => { clearTimer(); if (open && pinned) close(); else { setOpen(true); setPinned(true) } },
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
      })}
      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={typeof title === 'string' ? title : 'Comments'}
            onMouseEnter={clearTimer}
            onMouseLeave={scheduleClose}
            onFocusCapture={() => setPinned(true)}
            style={{ left: coords?.left ?? -9999, top: coords?.top ?? -9999, width, maxHeight: coords?.maxHeight }}
            className="fixed z-[1300] flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white text-slate-900 shadow-[0_18px_48px_-18px_rgba(15,23,42,0.45)] animate-in fade-in-0 zoom-in-95 duration-150 dark:border-slate-600/60 dark:bg-slate-900 dark:text-slate-100"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-3.5 py-2.5 dark:border-slate-700">
              <div className="min-w-0 text-xs font-semibold">{title}</div>
              <button type="button" aria-label="Close comments" onClick={close}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <div className="enterprise-popover-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{children}</div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}
