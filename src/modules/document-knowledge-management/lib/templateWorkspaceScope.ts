import type { DocumentTemplateResponse } from '@/lib/api/documentKnowledgeApi'
import { belongsToDkmRepositoryScope, type WorkspaceScope } from '@/lib/tenantWorkspaceScope'
import type { TenantMode } from '@/lib/onboardingFeature'

export interface TemplateWorkspaceCandidate {
  id: string
  name: string
  /** Needed only for the opt-in organization-sharing check below; omit where irrelevant. */
  organizationId?: string | null
  tenantMode?: TenantMode | null
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
 * Opt-in cross-workspace visibility: a template explicitly listing `scope.workspaceId` in
 * `metadata.shared_with_workspace_ids` is also usable from that specific workspace — but only for
 * the current user, and only because `workspaceCandidates` is built from that user's own
 * `useUserWorkspaceOptions()` (already WAC-filtered). If the listed workspace isn't in that list,
 * it simply can't be found below, so no separate permission check is needed here. The listed
 * workspace must also share the SAME organization as the template's own workspace — a safety
 * bound so a stray/mistaken entry in metadata can never leak a template across organizations.
 */
function isSharedWithWorkspace(
  template: DocumentTemplateResponse,
  templateWorkspaceId: string,
  scope: WorkspaceScope,
  workspaceCandidates?: TemplateWorkspaceCandidate[],
): boolean {
  if (scope.mode !== 'single' || !workspaceCandidates?.length) return false

  const sharedIds = template.metadata?.shared_with_workspace_ids
  if (!Array.isArray(sharedIds) || !sharedIds.includes(scope.workspaceId)) return false

  const templateWorkspace = workspaceCandidates.find((candidate) => candidate.id === templateWorkspaceId)
  const currentWorkspace = workspaceCandidates.find((candidate) => candidate.id === scope.workspaceId)
  if (!currentWorkspace?.organizationId || !templateWorkspace?.organizationId) return false

  return currentWorkspace.organizationId === templateWorkspace.organizationId
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
  return isSharedWithWorkspace(template, workspaceId, scope, workspaceCandidates)
}
