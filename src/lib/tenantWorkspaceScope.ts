import { ALL_WORKSPACES_ID, TENANT_STORAGE_KEY, type StoredTenantSelection, type TenantMode } from './onboardingFeature'
import { readAccessibleWorkspaceIds } from './corporateWorkspaceAccess'

export { ALL_WORKSPACES_ID }

export type WorkspaceScope =
  | { mode: 'all'; workspaceIds?: string[] }
  | { mode: 'single'; workspaceId: string; tenantMode: TenantMode | null }

export function isAllWorkspacesSelection(workspaceId: string | null | undefined): boolean {
  return !workspaceId || workspaceId === ALL_WORKSPACES_ID
}

export function readStoredTenantSelection(): StoredTenantSelection | null {
  try {
    const raw = sessionStorage.getItem(TENANT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredTenantSelection
  } catch {
    return null
  }
}

export function buildWorkspaceScopeFromTenant(
  tenant: Pick<StoredTenantSelection, 'workspaceId' | 'tenantMode' | 'selectedWorkspaceIds'> | null | undefined,
): WorkspaceScope {
  if (!tenant?.workspaceId || isAllWorkspacesSelection(tenant.workspaceId)) {
    const selected = (tenant?.selectedWorkspaceIds ?? []).filter((id) => Boolean(id?.trim()))
    return { mode: 'all', workspaceIds: selected.length > 0 ? selected : undefined }
  }
  return { mode: 'single', workspaceId: tenant.workspaceId, tenantMode: tenant.tenantMode ?? null }
}

export function readActiveWorkspaceScope(): WorkspaceScope {
  return buildWorkspaceScopeFromTenant(readStoredTenantSelection())
}

/** True when every workspace in the switcher accessible list is explicitly selected. */
export function isFullAccessibleWorkspaceSelection(
  selectedIds: string[],
  accessibleIds: string[] | null | undefined,
): boolean {
  const selected = selectedIds.filter(Boolean)
  if (selected.length === 0) return false
  const accessible = (accessibleIds ?? []).filter(Boolean)
  if (accessible.length === 0) return false
  if (selected.length < accessible.length) return false
  const selectedSet = new Set(selected)
  return accessible.every((id) => selectedSet.has(id))
}

function allowedIdsForAllScope(scope: Extract<WorkspaceScope, { mode: 'all' }>): string[] | null {
  if (scope.workspaceIds?.length) return scope.workspaceIds
  return readAccessibleWorkspaceIds()
}

export function resolveWorkspaceApiId(workspaceId?: string | null): string | undefined {
  if (!workspaceId || isAllWorkspacesSelection(workspaceId)) return undefined
  return workspaceId
}

/** Workspace id used for create/update when the UI is scoped to one workspace. */
export function resolveWorkspaceIdForWrite(scope: WorkspaceScope): string | undefined {
  if (scope.mode === 'single') return scope.workspaceId
  const allowed = allowedIdsForAllScope(scope)
  return allowed?.[0]
}

/**
 * List/query parameter for project & folder APIs.
 * Personal workspace: filter server-side by workspace_id.
 * Organization workspace: omit filter so legacy untagged seed rows are returned, then scope client-side.
 */
export function resolveWorkspaceIdForFetch(scope: WorkspaceScope): string | undefined {
  if (scope.mode !== 'single') {
    return resolveWorkspaceIdForWrite(scope)
  }
  if (scope.tenantMode === 'personal') return scope.workspaceId
  return undefined
}

/**
 * Apply the workspace id we sent on create when the API omits `workspace_id` in the response.
 * Do not use this on list/fetch — legacy untagged rows must stay hidden.
 */
export function applyWorkspaceIdFromWrite(
  entityWorkspaceId: string | null | undefined,
  writeWorkspaceId: string | undefined,
): string | null | undefined {
  if (entityWorkspaceId) return entityWorkspaceId
  return writeWorkspaceId ?? entityWorkspaceId
}

/**
 * Visibility rules:
 * - tagged row: must match active workspace_id (single) or accessible set (all)
 * - untagged legacy row: hidden in personal single-workspace mode; visible in organization
 *   single-workspace and all-workspaces scope (shared seed / legacy corpus)
 */
export function belongsToActiveWorkspaceScope(
  entityWorkspaceId: string | null | undefined,
  scope: WorkspaceScope,
): boolean {
  if (!entityWorkspaceId) {
    if (scope.mode !== 'single') {
      // Legacy untagged rows (seed + older creates) belong to the org corpus.
      // Hide them in personal single-workspace mode only; show for org workspace and all-workspaces scope.
      if (scope.mode === 'all') return true
      return false
    }
    return scope.tenantMode !== 'personal'
  }
  if (scope.mode === 'all') {
    const allowed = allowedIdsForAllScope(scope)
    if (!allowed?.length) return false
    return allowed.includes(entityWorkspaceId)
  }
  return entityWorkspaceId === scope.workspaceId
}

/**
 * Document Repository / DKM visibility.
 * Untagged legacy rows (`workspace_id` null) stay hidden for normal users so shared-DB
 * leftovers do not leak into a new organization workspace.
 * Platform admin / root can additionally exclude org-private corpora (e.g. Adira Finance)
 * via `isWorkspaceExcluded`.
 */
export function belongsToDkmRepositoryScope(
  entityWorkspaceId: string | null | undefined,
  scope: WorkspaceScope,
  opts?: {
    includeUntaggedLegacy?: boolean
    /** Return true to force-hide a workspace corpus (e.g. Adira Finance for root). */
    isWorkspaceExcluded?: (workspaceId: string) => boolean
  },
): boolean {
  const includeLegacy = opts?.includeUntaggedLegacy === true
  if (!entityWorkspaceId) return includeLegacy
  if (opts?.isWorkspaceExcluded?.(entityWorkspaceId)) return false

  if (scope.mode === 'all') {
    if (includeLegacy) return true
    const allowed = allowedIdsForAllScope(scope)
    if (allowed?.length) return allowed.includes(entityWorkspaceId)
    // Federated scope with no explicit subset yet — show tagged rows until allow-list hydrates.
    // Caller may still hide specific corpora via `isWorkspaceExcluded` (e.g. Adira for root).
    return true
  }
  return entityWorkspaceId === scope.workspaceId
}

/** Folders visible in DKM: ancestors of in-scope docs, plus folders owned by the current subject. */
export function filterDkmFoldersForRepositoryScope<T extends {
  id: string
  parent_id: string | null
  owner_id: string
  document_count: number
  children_count: number
}>(
  folders: T[],
  scopedDocumentFolderIds: Array<string | null | undefined>,
  currentOwnerId: string | null | undefined,
): T[] {
  if (folders.length === 0) return folders

  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const keep = new Set<string>()

  const retainWithAncestors = (folderId: string | null | undefined) => {
    let cursor = folderId ?? null
    let guard = 0
    while (cursor && guard < 64) {
      if (keep.has(cursor)) break
      keep.add(cursor)
      cursor = byId.get(cursor)?.parent_id ?? null
      guard += 1
    }
  }

  for (const folderId of scopedDocumentFolderIds) {
    retainWithAncestors(folderId)
  }

  const owner = (currentOwnerId || '').trim()
  if (owner) {
    for (const folder of folders) {
      if (folder.owner_id === owner) retainWithAncestors(folder.id)
    }
  }

  const scopedDocsByFolder = new Map<string, number>()
  for (const folderId of scopedDocumentFolderIds) {
    if (!folderId) continue
    scopedDocsByFolder.set(folderId, (scopedDocsByFolder.get(folderId) ?? 0) + 1)
  }

  const visible = folders.filter((folder) => keep.has(folder.id))
  return visible.map((folder) => ({
    ...folder,
    document_count: scopedDocsByFolder.get(folder.id) ?? 0,
    children_count: visible.filter((child) => child.parent_id === folder.id).length,
  }))
}
