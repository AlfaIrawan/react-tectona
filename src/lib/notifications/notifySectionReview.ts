import { createNotification, TECTONA_APP_ID } from '@/lib/api/notificationApi'

/** Everything a section-review notification needs that only the idea page knows. */
export type SectionReviewNotifyContext = {
  ideaId: string
  ideaTitle: string
  /** Link to the idea page; `?review=<section>` is appended so it opens Version history. */
  linkUrl: string
  /** Who reviews new revisions: the idea's assigned reviewer, else its owner. */
  reviewerIds: string[]
  actorId: string
  actorName: string
}

export type SectionReviewEvent =
  | { kind: 'submitted'; sectionKey: string; sectionLabel: string; revisionId: string; changedLabels: string[] }
  | { kind: 'request_changes' | 'reject' | 'approve'; sectionKey: string; sectionLabel: string; revisionId: string; authorId: string; comment?: string }

const TITLES: Record<SectionReviewEvent['kind'], (label: string) => string> = {
  submitted: (label) => `${label}: perubahan menunggu approval`,
  request_changes: (label) => `${label}: diminta revisi`,
  reject: (label) => `${label}: perubahan ditolak`,
  approve: (label) => `${label}: perubahan disetujui`,
}

/**
 * Tell the right people about a section-review step, through the same bell
 * notifications C4 architecture review uses. Best effort: a notification
 * failure never blocks or undoes the review action itself.
 */
export function notifySectionReview(ctx: SectionReviewNotifyContext | undefined, event: SectionReviewEvent): void {
  if (!ctx) return
  const recipients = event.kind === 'submitted' ? ctx.reviewerIds : [event.authorId]
  const unique = [...new Set(recipients.map((id) => id.trim()).filter((id) => id && id !== ctx.actorId))]
  if (!unique.length) return
  const detail = event.kind === 'submitted'
    ? `${ctx.actorName} mengubah ${event.changedLabels.join(', ') || event.sectionLabel}`
    : `${ctx.actorName}${event.comment ? `: "${event.comment}"` : ''}`
  const separator = ctx.linkUrl.includes('?') ? '&' : '?'
  void Promise.allSettled(unique.map((userId) => createNotification({
    app_id: TECTONA_APP_ID,
    user_id: userId,
    type_code: 'todo',
    title: TITLES[event.kind](event.sectionLabel),
    body: `${ctx.ideaTitle} — ${detail}`,
    link_url: `${ctx.linkUrl}${separator}review=${encodeURIComponent(event.sectionKey)}`,
    metadata: { idea_id: ctx.ideaId, section_key: event.sectionKey, revision_id: event.revisionId, review_action: event.kind },
    created_by: ctx.actorId,
    created_from: 'tectona-section-review',
  })))
}

export type SectionThreadEvent = {
  kind: 'discussion_opened' | 'reply' | 'revision_requested' | 'thread_closed' | 'mention'
  sectionKey: string
  /** e.g. "Summary · Value Thesis" */
  targetLabel: string
  threadId: string
  recipients: string[]
  excerpt?: string
}

const THREAD_TITLES: Record<SectionThreadEvent['kind'], (target: string) => string> = {
  discussion_opened: (target) => `${target}: new discussion`,
  reply: (target) => `${target}: new reply`,
  revision_requested: (target) => `${target}: revision requested from you`,
  thread_closed: (target) => `${target}: thread closed`,
  mention: (target) => `${target}: you were mentioned`,
}

/** Bell notifications for card discussions and revision requests. Best effort, like notifySectionReview. */
export function notifySectionThread(ctx: SectionReviewNotifyContext | undefined, event: SectionThreadEvent): void {
  if (!ctx) return
  const unique = [...new Set(event.recipients.map((id) => (id ?? '').trim()).filter((id) => id && id !== ctx.actorId))]
  if (!unique.length) return
  const separator = ctx.linkUrl.includes('?') ? '&' : '?'
  const excerpt = event.excerpt ? `: "${event.excerpt.length > 140 ? `${event.excerpt.slice(0, 137)}…` : event.excerpt}"` : ''
  void Promise.allSettled(unique.map((userId) => createNotification({
    app_id: TECTONA_APP_ID,
    user_id: userId,
    type_code: 'todo',
    title: THREAD_TITLES[event.kind](event.targetLabel),
    body: `${ctx.ideaTitle} — ${ctx.actorName}${excerpt}`,
    link_url: `${ctx.linkUrl}${separator}thread=${encodeURIComponent(event.threadId)}`,
    metadata: { idea_id: ctx.ideaId, section_key: event.sectionKey, thread_id: event.threadId, thread_event: event.kind },
    created_by: ctx.actorId,
    created_from: 'tectona-section-thread',
  })))
}
