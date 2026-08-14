import type { AccessRequestDto } from '@/lib/api/workspaceAccessControlApi'

const JOIN_WORKSPACE_MARKER_RE =
  /\[(personal_workspace_id|operational_workspace_id)=([0-9a-f-]{36})\]/i

export type AccessRequestJoinWorkspaceKind = 'personal' | 'operational' | 'unknown'

export type AccessRequestJoinWorkspaceInfo = {
  workspaceId: string
  workspaceName: string
  kind: AccessRequestJoinWorkspaceKind
  kindLabel: string
}

export type PendingAccessRequestDisplay = {
  detail: string
  note: string | null
  joinWorkspace: AccessRequestJoinWorkspaceInfo | null
}

type WorkspaceCatalogRow = {
  id: string
  name?: string | null
  isPersonalWorkspace?: boolean
  type?: string | null
}

function accessRequestMessageRaw(req: AccessRequestDto): string {
  return `${req.request_message ?? ''} ${req.message ?? ''}`.trim()
}

export function parseJoinWorkspaceMarkerFromAccessRequestMessage(raw: string): {
  workspaceId: string
  kind: 'personal' | 'operational'
} | null {
  const match = JOIN_WORKSPACE_MARKER_RE.exec(raw)
  if (!match?.[2]) return null
  const markerKey = match[1]?.toLowerCase()
  return {
    workspaceId: match[2],
    kind: markerKey === 'operational_workspace_id' ? 'operational' : 'personal',
  }
}

function kindLabelForJoinWorkspace(kind: AccessRequestJoinWorkspaceKind): string {
  if (kind === 'personal') return 'Personal workspace'
  if (kind === 'operational') return 'Operational workspace'
  return 'Workspace'
}

function inferJoinWorkspaceKind(
  markerKind: 'personal' | 'operational' | null,
  catalogRow: WorkspaceCatalogRow | undefined,
): AccessRequestJoinWorkspaceKind {
  if (markerKind) return markerKind
  if (catalogRow?.isPersonalWorkspace) return 'personal'
  if (catalogRow?.type && catalogRow.type !== 'Organization') return 'operational'
  return 'unknown'
}

export function resolveAccessRequestJoinWorkspace(
  req: AccessRequestDto,
  catalog: ReadonlyArray<WorkspaceCatalogRow>,
  nameOverrides?: Readonly<Record<string, string>>,
): AccessRequestJoinWorkspaceInfo | null {
  const raw = accessRequestMessageRaw(req)
  const marker = parseJoinWorkspaceMarkerFromAccessRequestMessage(raw)
  // WAC stores the review org workspace on workspace_id; the joined workspace id is in the message marker.
  const workspaceId = marker?.workspaceId || req.workspace_id?.trim()
  if (!workspaceId) return null

  const catalogRow = catalog.find((row) => row.id === workspaceId)
  const kind = inferJoinWorkspaceKind(marker?.kind ?? null, catalogRow)
  const workspaceName =
    catalogRow?.name?.trim()
    || nameOverrides?.[workspaceId]?.trim()
    || workspaceId

  return {
    workspaceId,
    workspaceName,
    kind,
    kindLabel: kindLabelForJoinWorkspace(kind),
  }
}

/** Org workspace where admins review the request (access_requests.workspace_id). */
export function resolveAccessRequestReviewOrgWorkspaceId(req: AccessRequestDto): string | null {
  return req.workspace_id?.trim() || null
}

export function isCorporateOnboardingAccessRequest(req: AccessRequestDto): boolean {
  const raw = accessRequestMessageRaw(req)
  return /corporate onboarding|admin approval|personal_workspace_id=|operational_workspace_id=/i.test(raw)
}

function stripJoinWorkspaceMarkers(message: string): string {
  return message
    .replace(/\s*\[personal_workspace_id=[0-9a-f-]{36}\]/gi, '')
    .replace(/\s*\[operational_workspace_id=[0-9a-f-]{36}\]/gi, '')
    .trim()
}

export function pendingAccessRequestDisplay(
  req: AccessRequestDto,
  catalog: ReadonlyArray<WorkspaceCatalogRow> = [],
  nameOverrides?: Readonly<Record<string, string>>,
): PendingAccessRequestDisplay {
  const joinWorkspace = resolveAccessRequestJoinWorkspace(req, catalog, nameOverrides)

  if (isCorporateOnboardingAccessRequest(req)) {
    return {
      detail: joinWorkspace
        ? `${joinWorkspace.workspaceName} · ${joinWorkspace.kindLabel}`
        : 'New corporate user',
      note: joinWorkspace
        ? 'Awaiting approval to join the organization directory.'
        : 'Awaiting approval to use the platform.',
      joinWorkspace,
    }
  }

  const cleaned = stripJoinWorkspaceMarkers(req.request_message ?? req.message ?? '')
  return {
    detail: joinWorkspace
      ? `${joinWorkspace.workspaceName} · ${joinWorkspace.kindLabel}`
      : `Role: ${req.requested_role_code || 'member'}`,
    note: cleaned || null,
    joinWorkspace,
  }
}

export function approveAccessRequestDescription(
  joinWorkspace: AccessRequestJoinWorkspaceInfo | null,
  orgWorkspaceName: string | null | undefined,
): string {
  const orgLabel = orgWorkspaceName?.trim() || 'the organization workspace'
  if (!joinWorkspace) {
    return `Grant workspace access and link this user's workspace under ${orgLabel}.`
  }
  return `Grant access and link ${joinWorkspace.workspaceName} (${joinWorkspace.kindLabel.toLowerCase()}) under ${orgLabel}.`
}
