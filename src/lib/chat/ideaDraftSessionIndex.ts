import type { IdeaDraftBrainstormPointer } from '@/stores/idea-draft-brainstorm-pointer-store'

export function isActiveIdeaDraft(session: IdeaDraftBrainstormPointer): boolean {
  return Boolean(session.draftSessionId) && !session.ideaId
    && ['queued', 'running', 'awaiting_input', 'completed'].includes(session.status ?? '')
}

export function ideaDraftSessionPreview(session: IdeaDraftBrainstormPointer): string {
  if (session.ideaId) return 'Created - view idea'
  if (session.status === 'failed') return 'Generation failed - tap to review'
  if (session.status === 'cancelled') return 'Cancelled session - tap to review'
  if (!isActiveIdeaDraft(session)) return 'Previous session - tap to review'
  if (session.status === 'completed') return 'Draft ready - tap to resume'
  if (session.status === 'queued' || session.status === 'running') return 'Generating draft - tap to reopen'
  return 'Draft - tap to resume'
}

/** Only proven session identities are grouped. Equal titles are never evidence of duplication. */
export function indexIdeaDraftSessions(
  sessions: IdeaDraftBrainstormPointer[], ownerId: string, workspaceIds?: string[],
): IdeaDraftBrainstormPointer[] {
  if (!ownerId) return []
  const indexed = new Map<string, IdeaDraftBrainstormPointer>()
  for (const session of sessions) {
    if (session.ownerId !== ownerId || (workspaceIds && !workspaceIds.includes(session.workspaceId ?? ''))) continue
    const key = `${session.workspaceId ?? ''}:${session.draftSessionId ?? `legacy:${session.jobId}`}`
    const previous = indexed.get(key)
    if (!previous) { indexed.set(key, session); continue }
    const latest = previous.updatedAt > session.updatedAt ? previous : session
    indexed.set(key, { ...latest, ideaId: session.ideaId || previous.ideaId })
  }
  return [...indexed.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
