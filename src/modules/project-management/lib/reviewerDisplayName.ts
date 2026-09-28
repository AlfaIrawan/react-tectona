const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ReviewerNameResolver = (subjectId: string) => string

/**
 * Human name for a revision author/approver. Revisions store identity subject
 * ids (GUIDs); those must never reach the UI. Resolution order: the signed-in
 * user, then the identity directory; an unresolved GUID becomes a neutral label.
 */
export function reviewerDisplayName(
  subjectId: string | null | undefined,
  { userId, userName, resolve }: { userId?: string | null; userName?: string | null; resolve?: ReviewerNameResolver },
): string {
  const raw = (subjectId ?? '').trim()
  if (!raw) return ''
  if (userId && raw === userId) return userName?.trim() || resolve?.(raw)?.trim() || 'You'
  if (raw === 'system') return 'Tectona AI'
  const resolved = resolve?.(raw)?.trim()
  if (resolved && resolved !== raw) return resolved
  return UUID_RE.test(raw) ? 'another user' : raw
}
