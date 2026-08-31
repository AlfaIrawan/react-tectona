import type { DocumentTemplateResponse } from '@/lib/api/documentKnowledgeApi'
import { belongsToDkmRepositoryScope, type WorkspaceScope } from '@/lib/tenantWorkspaceScope'
import type { TenantMode } from '@/lib/onboardingFeature'

export interface TemplateWorkspaceCandidate {
  id: string
  name: string
  /** Needed only for the opt-in organization-sharing check below; omit where irrelevant. */
  organizationId?: string | null
  tenantMode?: TenantMode | null
  /** Lowercased name + owner labels for picker search (not people-share). */
  searchHaystack?: string
}

/** Directory row used to build the Share picker (org-wide, not WAC-filtered). */
export interface TemplateShareDirectoryWorkspace {
  id: string
  name: string
  organizationId: string
  tenantMode?: TenantMode | null
  parentWorkspaceId?: string | null
  statusCode?: string | null
  searchHaystack?: string
}

const SHARE_SEARCH_META_KEYS = [
  'tectona_owner',
  'tectona_business_owner',
  'tectona_technical_owner',
  'tectona_owner_identity_ref',
] as const

/** Name + owner strings so "Stella" matches Stella's personal workspace. */
export function collectWorkspaceShareSearchLabels(input: {
  name: string
  tenantMode?: TenantMode | null
  createdBy?: string | null
  metadata?: Record<string, unknown> | null
}): string {
  const parts = [input.name]
  if (input.tenantMode === 'personal') parts.push('personal')
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  for (const key of SHARE_SEARCH_META_KEYS) {
    const value = meta[key]
    if (typeof value === 'string' && value.trim()) parts.push(value.trim())
  }
  if (input.createdBy?.trim()) parts.push(input.createdBy.trim())
  return parts.join(' ').toLowerCase()
}

/** Direct + nested children of `parentId` (archived rows skipped). */
export function descendantWorkspaceIds(
  parentId: string,
  directory: TemplateShareDirectoryWorkspace[],
): string[] {
  const root = parentId.trim()
  if (!root) return []
  const childrenByParent = new Map<string, string[]>()
  for (const row of directory) {
    if (isArchivedWorkspace(row.statusCode)) continue
    const parent = row.parentWorkspaceId?.trim()
    if (!parent) continue
    const list = childrenByParent.get(parent) ?? []
    list.push(row.id)
    childrenByParent.set(parent, list)
  }
  const out: string[] = []
  const seen = new Set<string>([root])
  const stack = [...(childrenByParent.get(root) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    const nested = childrenByParent.get(id)
    if (nested?.length) stack.push(...nested)
  }
  return out
}

export function expandShareSelectionWithChildren(
  selectedId: string,
  directory: TemplateShareDirectoryWorkspace[],
  includeChildren: boolean,
): string[] {
  const id = selectedId.trim()
  if (!id) return []
  if (!includeChildren) return [id]
  return [id, ...descendantWorkspaceIds(id, directory)]
}

function isArchivedWorkspace(statusCode?: string | null): boolean {
  return (statusCode ?? '').trim().toLowerCase() === 'archived'
}

/**
 * Workspaces that may receive a template share grant.
 * Includes every active workspace in the template's organization — personal
 * workspaces included — even when the current user is not a member.
 * Nested personal workspaces (parent in the org tree, possibly another org id)
 * are included so names like "Stella WS" appear next to "IT Business Partner WS".
 */
export function listTemplateShareWorkspaceOptions(input: {
  templateWorkspaceId: string
  templateOrganizationId: string | null | undefined
  directory: TemplateShareDirectoryWorkspace[]
}): TemplateWorkspaceCandidate[] {
  const ownerId = input.templateWorkspaceId.trim()
  const orgId = input.templateOrganizationId?.trim() || ''
  if (!ownerId || !orgId) return []

  const byId = new Map(input.directory.map((row) => [row.id, row]))
  const eligible = new Set<string>()

  for (const row of input.directory) {
    if (isArchivedWorkspace(row.statusCode)) continue
    if (row.organizationId === orgId) eligible.add(row.id)
  }

  let grew = true
  while (grew) {
    grew = false
    for (const row of input.directory) {
      if (isArchivedWorkspace(row.statusCode) || eligible.has(row.id)) continue
      const parentId = row.parentWorkspaceId?.trim()
      if (parentId && eligible.has(parentId)) {
        eligible.add(row.id)
        grew = true
      }
    }
  }

  eligible.delete(ownerId)

  return [...eligible]
    .map((id) => {
      const row = byId.get(id)
      if (!row) return null
      return {
        id: row.id,
        name: row.name,
        organizationId: row.organizationId,
        tenantMode: row.tenantMode ?? null,
        searchHaystack: row.searchHaystack || row.name.toLowerCase(),
      } satisfies TemplateWorkspaceCandidate
    })
    .filter((row): row is TemplateWorkspaceCandidate => Boolean(row))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
}

function workspaceNameToFileSegment(workspaceName: string): string {
  return workspaceName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^(AI|API|KB|BRD|IT|ERP|CRM|SCF|FMCG|HO|WS)$/i.test(part)) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).replace(/[^A-Za-z0-9]/g, '')
    })
    .join('')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase()
}

/** Resolve workspace tag for a template row (column, metadata, or legacy name inference). */
export function resolveTemplateWorkspaceId(
  template: DocumentTemplateResponse,
  workspaceCandidates?: TemplateWorkspaceCandidate[],
): string | null {
  const fromColumn = typeof template.workspace_id === 'string' ? template.workspace_id.trim() : ''
  if (fromColumn) return fromColumn

  const metaWs = template.metadata?.workspace_id
  if (typeof metaWs === 'string' && metaWs.trim()) return metaWs.trim()

  const title = template.name?.trim() || template.latest_file_name?.trim() || ''
  const segmentMatch = title.match(/^(?:BRD|URD|FSD|TPL)_([A-Za-z0-9]+)_/i)
  if (!segmentMatch || !workspaceCandidates?.length) return null

  const segment = segmentMatch[1].toLowerCase()
  const matched = workspaceCandidates.find(
    (candidate) => workspaceNameToFileSegment(candidate.name) === segment,
  )
  return matched?.id ?? null
}

/**
 * Opt-in cross-workspace visibility: the current DKM workspace id is listed on
 * `metadata.shared_with_workspace_ids`. Recipients do not need membership in the
 * owner workspace (e.g. Stella in Stella WS can use a template owned by Adira Finance WS).
 */
function isSharedWithWorkspace(
  template: DocumentTemplateResponse,
  _templateWorkspaceId: string,
  scope: WorkspaceScope,
): boolean {
  if (scope.mode !== 'single') return false
  const sharedIds = template.metadata?.shared_with_workspace_ids
  return Array.isArray(sharedIds) && sharedIds.includes(scope.workspaceId)
}

export function belongsToDkmTemplateScope(
  template: DocumentTemplateResponse,
  scope: WorkspaceScope,
  workspaceCandidates?: TemplateWorkspaceCandidate[],
): boolean {
  const workspaceId = resolveTemplateWorkspaceId(template, workspaceCandidates)
  if (!workspaceId) {
    // Older master templates may not have a workspace_id yet. They belong to the
    // shared organization template library, but must not leak into personal workspaces.
    return scope.mode === 'all' || scope.tenantMode === 'organization'
  }
  if (belongsToDkmRepositoryScope(workspaceId, scope)) return true
  // Some older template rows contain a workspace name/legacy identifier instead
  // of the current UUID. If that identifier is not one of the user's visible
  // workspaces, keep it available in the organization library; the API response
  // is already tenant-authorized, and personal workspaces remain excluded.
  if (
    scope.mode === 'single'
    && scope.tenantMode === 'organization'
    && workspaceCandidates?.length
    && !workspaceCandidates.some((candidate) => candidate.id === workspaceId)
  ) {
    return true
  }
  return isSharedWithWorkspace(template, workspaceId, scope)
}
