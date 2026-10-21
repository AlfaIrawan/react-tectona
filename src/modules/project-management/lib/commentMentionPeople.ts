import { isOrganizationHomeWorkspace } from '@/lib/workspaceOwnershipVisibility'

type DirectoryWorkspace = {
  id: string
  organization_id?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * The organization home above a workspace: up its parent_workspace_id chain, or else the home of
 * the same organization. Null when the directory does not know one.
 */
export function organizationHomeWorkspaceId(workspaceId: string, directory: DirectoryWorkspace[]): string | null {
  const byId = new Map(directory.map((workspace) => [workspace.id, workspace]))
  const seen = new Set<string>()
  let current = byId.get(workspaceId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (isOrganizationHomeWorkspace(current)) return current.id
    const parent = current.metadata?.parent_workspace_id
    current = typeof parent === 'string' && parent.trim() ? byId.get(parent.trim()) : undefined
  }
  const organizationId = byId.get(workspaceId)?.organization_id
  if (!organizationId) return null
  return directory.find((workspace) => workspace.organization_id === organizationId && isOrganizationHomeWorkspace(workspace))?.id ?? null
}

/** Active members of membership rows (no status means active), each once. */
export function activeMemberIds(rows: Array<{ subject_id: string; membership_status?: string | null; status_code?: string | null }>): string[] {
  return [...new Set(rows
    .filter((row) => {
      const status = (row.membership_status ?? row.status_code ?? '').toLowerCase().trim()
      return status === '' || status === 'active'
    })
    .map((row) => row.subject_id)
    .filter(Boolean))]
}
