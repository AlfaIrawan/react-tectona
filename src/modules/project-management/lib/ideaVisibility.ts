import { belongsToActiveWorkspaceScope, type WorkspaceScope } from '@/lib/tenantWorkspaceScope'

type IdeaIdentity = {
  workspace_id?: string | null
  source_workspace_id?: string | null
  owner_id?: string | null
  created_by?: string | null
}

/** Presentation guard only; the API authenticates the owner-inclusive query. */
export function isIdeaVisibleInScope(idea: IdeaIdentity, scope: WorkspaceScope, userId?: string | null): boolean {
  if (belongsToActiveWorkspaceScope(idea.workspace_id, scope)) return true
  const subject = userId?.trim()
  return Boolean(subject && idea.source_workspace_id
    && belongsToActiveWorkspaceScope(idea.source_workspace_id, scope)
    && (idea.owner_id === subject || idea.created_by === subject))
}

export function isIdeaInFolder(
  idea: { workspace?: string; folderId?: string | null },
  folderId: string | null,
  scope: WorkspaceScope,
): boolean {
  // A foreign workspace's folders are not part of this tree. Keep the real folder ID
  // for writes, but show the owner's cross-workspace submission at the list root.
  if (scope.mode === 'single' && idea.workspace && idea.workspace !== scope.workspaceId) return folderId === null
  return (idea.folderId || null) === folderId
}
