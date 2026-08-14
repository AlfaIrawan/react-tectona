/**
 * Workspace Access Control (shared WAC) API client.
 * Backend: python-workspace-access-control-service-fastapi (port 8421).
 */

import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'

import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

export const TECTONA_WAC_APP_ID = TECTONA_AUTHZ_APP_ID

const BASE_URL =
  (import.meta.env.VITE_WORKSPACE_ACCESS_CONTROL_API_URL as string | undefined)?.trim()?.replace(/\/$/, '')
  || (import.meta.env.DEV
    ? '/api/workspace-access-control'
    : serviceApiBase('/api/workspace-access-control'))

function wacWebSocketBaseUrl(): string {
  const override = (import.meta.env.VITE_WORKSPACE_ACCESS_CONTROL_API_URL as string | undefined)?.replace(/\/$/, '')
  if (override) return override
  return '/api/workspace-access-control'
}

/** Dev: WS uses Vite proxy `/api/workspace-access-control` → WAC :8421. */
export function createWacEventsWebSocketUrl(options?: { token?: string }): string {
  const rawBase = wacWebSocketBaseUrl()
  const url =
    rawBase.startsWith('http://') || rawBase.startsWith('https://')
      ? new URL(rawBase)
      : new URL(rawBase, window.location.origin)

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/ws/events`
  url.search = ''
  if (options?.token) {
    url.searchParams.set('token', options.token)
  }
  return url.toString()
}

export type WacMembershipDto = {
  id: string
  app_id: string
  workspace_id: string
  subject_id: string
  role_id: string
  role_code: string
  role_display_name?: string | null
  status_code?: string
  membership_status?: string
  participation_scope_code?: string | null
  participation_scope_display_name?: string | null
  operational_team_id?: string | null
  operational_team_code?: string | null
  operational_team_display_name?: string | null
  operational_teams?: { id: string; team_code: string; display_name: string }[]
  participation_duration_code?: string | null
  participation_start_date?: string | null
  participation_end_date?: string | null
  version: number
}

export type WacMemberListResponse = {
  items: WacMembershipDto[]
  total: number
}

export type WacMembershipCreatePayload = {
  subject_id: string
  role_code: string
  status_code?: string
  participation_scope_code?: string
  operational_team_codes?: string[]
  /** @deprecated Use operational_team_codes */
  operational_team_code?: string
  participation_duration_code?: string
  participation_start_date?: string
  participation_end_date?: string
  /** Project ids from project-service (wac_membership_scopes scope_type project). */
  project_scope_refs?: string[]
  /** Folder ids from project-service as program grouping until dedicated program SoR. */
  program_scope_refs?: string[]
}

export type WacMembershipPatchPayload = {
  role_code?: string
  status_code?: string
  participation_scope_code?: string
  operational_team_codes?: string[]
  /** @deprecated Use operational_team_codes */
  operational_team_code?: string
  participation_duration_code?: string
  participation_start_date?: string | null
  participation_end_date?: string | null
  version?: number
}

function wacErrorMessage(body: Record<string, unknown>, fallback: string): string {
  const err = body.error
  if (err && typeof err === 'object' && err !== null) {
    const msg = (err as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  if (typeof body.detail === 'string' && body.detail.trim()) return body.detail.trim()
  if (Array.isArray(body.detail))
    return body.detail.map((x: { msg?: string }) => x?.msg ?? JSON.stringify(x)).join('; ')
  if (body.detail != null) return JSON.stringify(body.detail)
  return fallback
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let detail = ''
    if (raw) {
      try {
        const body = JSON.parse(raw) as Record<string, unknown>
        detail = wacErrorMessage(body, '')
      } catch {
        detail = raw
      }
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function wacUrl(path: string): string {
  const base = BASE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

function mutationHeaders(opts?: {
  actorId?: string
  correlationId?: string
  idempotencyKey?: string
}): Headers {
  const extra: Record<string, string> = {}
  if (opts?.actorId) extra['X-Actor-Id'] = opts.actorId
  if (opts?.correlationId) extra['X-Correlation-Id'] = opts.correlationId
  if (opts?.idempotencyKey) extra['Idempotency-Key'] = opts.idempotencyKey
  return new Headers(tectonaServiceHeaders(extra))
}

// Multiple callers (member counts, full roster, live panel refresh, polling ticks) request the
// same workspace's members within milliseconds of each other. Coalesce concurrent requests and
// cache the result briefly so those calls share one network round trip instead of firing N each.
const workspaceMembersCache = new Map<
  string,
  { promise: Promise<WacMemberListResponse> } | { data: WacMemberListResponse; expiresAt: number }
>()
const WORKSPACE_MEMBERS_CACHE_TTL_MS = 2500

export function invalidateWorkspaceMembersCache(workspaceId?: string): void {
  if (!workspaceId) {
    workspaceMembersCache.clear()
    return
  }
  const suffix = `:${workspaceId}`
  for (const key of workspaceMembersCache.keys()) {
    if (key.endsWith(suffix)) workspaceMembersCache.delete(key)
  }
}

export async function fetchWorkspaceMembers(
  appId: string,
  workspaceId: string
): Promise<WacMemberListResponse> {
  const key = `${appId}:${workspaceId}`
  const cached = workspaceMembersCache.get(key)
  if (cached) {
    if ('promise' in cached) return cached.promise
    if (cached.expiresAt > Date.now()) return cached.data
  }
  const promise = (async () => {
    const res = await apiFetch(
      wacUrl(`/v1/apps/${encodeURIComponent(appId)}/workspaces/${encodeURIComponent(workspaceId)}/members`),
      { headers: tectonaServiceHeaders() }
    )
    return handleJson<WacMemberListResponse>(res)
  })()
  workspaceMembersCache.set(key, { promise })
  try {
    const data = await promise
    workspaceMembersCache.set(key, { data, expiresAt: Date.now() + WORKSPACE_MEMBERS_CACHE_TTL_MS })
    return data
  } catch (err) {
    workspaceMembersCache.delete(key)
    throw err
  }
}

export async function fetchSubjectMemberships(
  appId: string,
  subjectId: string,
  options?: { activeOnly?: boolean }
): Promise<WacMemberListResponse> {
  const activeOnly = options?.activeOnly !== false
  const res = await apiFetch(
    wacUrl(
      `/v1/apps/${encodeURIComponent(appId)}/subjects/${encodeURIComponent(subjectId)}/memberships?active_only=${activeOnly ? 'true' : 'false'}`
    ),
    { headers: tectonaServiceHeaders() }
  )
  return handleJson<WacMemberListResponse>(res)
}

export async function createWorkspaceMembership(
  appId: string,
  workspaceId: string,
  payload: WacMembershipCreatePayload,
  opts?: { actorId?: string; idempotencyKey?: string }
): Promise<WacMembershipDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/workspaces/${encodeURIComponent(workspaceId)}/memberships`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify({
        subject_id: payload.subject_id,
        role_code: payload.role_code,
        status_code: payload.status_code ?? 'active',
        participation_scope_code: payload.participation_scope_code ?? 'project_only',
        operational_team_codes: payload.operational_team_codes ?? (payload.operational_team_code ? [payload.operational_team_code] : []),
        project_scope_refs: payload.project_scope_refs ?? [],
        program_scope_refs: payload.program_scope_refs ?? [],
      }),
    }
  )
  return handleJson<WacMembershipDto>(res)
}

export async function patchWorkspaceMembership(
  appId: string,
  membershipId: string,
  payload: WacMembershipPatchPayload,
  opts?: { actorId?: string }
): Promise<WacMembershipDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/memberships/${encodeURIComponent(membershipId)}`),
    {
      method: 'PATCH',
      headers: mutationHeaders(opts),
      body: JSON.stringify({
        ...payload,
        operational_team_codes:
          payload.operational_team_codes
          ?? (payload.operational_team_code ? [payload.operational_team_code] : undefined),
      }),
    }
  )
  return handleJson<WacMembershipDto>(res)
}

export async function deleteWorkspaceMembership(
  appId: string,
  membershipId: string,
  opts?: { actorId?: string }
): Promise<void> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/memberships/${encodeURIComponent(membershipId)}`),
    {
      method: 'DELETE',
      headers: mutationHeaders(opts),
    }
  )
  await handleJson<void>(res)
}

export type WorkspaceMemberUiRole = 'Admin' | 'Manager' | 'Member' | 'Viewer'

export function wacRoleCodeToUiRole(roleCode: string): WorkspaceMemberUiRole {
  const code = roleCode.toLowerCase()
  if (code === 'owner' || code === 'admin') return 'Admin'
  if (code === 'editor') return 'Manager'
  if (code === 'viewer') return 'Viewer'
  return 'Member'
}

export function uiRoleToWacRoleCode(role: WorkspaceMemberUiRole): string {
  switch (role) {
    case 'Admin':
      return 'admin'
    case 'Manager':
      return 'editor'
    case 'Viewer':
      return 'viewer'
    default:
      return 'member'
  }
}

export type WacOperationalTeamDto = {
  id: string
  team_code: string
  display_name: string
  sort_order: number
}

export type WacOperationalTeamListResponse = {
  items: WacOperationalTeamDto[]
  total: number
}

export async function fetchOperationalTeams(appId: string): Promise<WacOperationalTeamListResponse> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/operational-teams`),
    { headers: tectonaServiceHeaders() }
  )
  return handleJson<WacOperationalTeamListResponse>(res)
}

export async function createOperationalTeam(
  appId: string,
  displayName: string,
  opts?: { actorId?: string }
): Promise<WacOperationalTeamDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/operational-teams`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify({ display_name: displayName }),
    }
  )
  return handleJson<WacOperationalTeamDto>(res)
}

export async function updateOperationalTeam(
  appId: string,
  teamId: string,
  displayName: string,
  opts?: { actorId?: string }
): Promise<WacOperationalTeamDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/operational-teams/${encodeURIComponent(teamId)}`),
    {
      method: 'PATCH',
      headers: mutationHeaders(opts),
      body: JSON.stringify({ display_name: displayName }),
    }
  )
  return handleJson<WacOperationalTeamDto>(res)
}

export async function deleteOperationalTeam(
  appId: string,
  teamId: string,
  opts?: { actorId?: string }
): Promise<void> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/operational-teams/${encodeURIComponent(teamId)}`),
    {
      method: 'DELETE',
      headers: mutationHeaders(opts),
    }
  )
  await handleJson<void>(res)
}

export type WacParticipationScopeDto = {
  id: string
  scope_code: string
  display_name: string
  sort_order: number
  is_system: boolean
}

export type WacParticipationScopeListResponse = {
  items: WacParticipationScopeDto[]
  total: number
}

export async function fetchParticipationScopes(appId: string): Promise<WacParticipationScopeListResponse> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/participation-scopes`),
    { headers: tectonaServiceHeaders() }
  )
  return handleJson<WacParticipationScopeListResponse>(res)
}

export async function updateParticipationScope(
  appId: string,
  scopeId: string,
  payload: { display_name?: string; sort_order?: number },
  opts?: { actorId?: string }
): Promise<WacParticipationScopeDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/participation-scopes/${encodeURIComponent(scopeId)}`),
    {
      method: 'PATCH',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    }
  )
  return handleJson<WacParticipationScopeDto>(res)
}

/** Cross-user share of one project/program/portfolio within a workspace (WAC migration 006). */
export type WacDeliveryShareDto = {
  id: string
  app_id: string
  workspace_id: string
  resource_type: 'project' | 'program' | 'portfolio'
  scope_ref: string
  grantor_subject_id: string
  grantee_subject_id: string
  permission_code: 'view' | 'collaborate' | 'manage'
  share_message?: string | null
  version: number
  expires_at?: string | null
  created_date?: string | null
}

export type WacDeliveryShareListResponse = {
  items: WacDeliveryShareDto[]
  total: number
}

export type WacDeliveryShareCreatePayload = {
  resource_type: 'project' | 'program' | 'portfolio'
  scope_ref: string
  grantee_subject_id: string
  permission_code?: 'view' | 'collaborate' | 'manage'
  share_message?: string
  expires_at?: string
}

export async function fetchDeliveryShares(
  appId: string,
  workspaceId: string,
  filters?: { granteeSubjectId?: string; grantorSubjectId?: string; resourceType?: string }
): Promise<WacDeliveryShareListResponse> {
  const q = new URLSearchParams()
  if (filters?.granteeSubjectId) q.set('grantee_subject_id', filters.granteeSubjectId)
  if (filters?.grantorSubjectId) q.set('grantor_subject_id', filters.grantorSubjectId)
  if (filters?.resourceType) q.set('resource_type', filters.resourceType)
  const suffix = q.toString() ? `?${q}` : ''
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/workspaces/${encodeURIComponent(workspaceId)}/delivery-shares${suffix}`),
    { headers: tectonaServiceHeaders() }
  )
  return handleJson<WacDeliveryShareListResponse>(res)
}

export async function createDeliveryShare(
  appId: string,
  workspaceId: string,
  payload: WacDeliveryShareCreatePayload,
  opts?: { actorId?: string }
): Promise<WacDeliveryShareDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/workspaces/${encodeURIComponent(workspaceId)}/delivery-shares`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    }
  )
  return handleJson<WacDeliveryShareDto>(res)
}

export async function revokeDeliveryShare(
  appId: string,
  shareId: string,
  opts?: { actorId?: string }
): Promise<void> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/delivery-shares/${encodeURIComponent(shareId)}`),
    {
      method: 'DELETE',
      headers: mutationHeaders(opts),
    }
  )
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let detail = ''
    if (raw) {
      try {
        const body = JSON.parse(raw) as Record<string, unknown>
        detail = wacErrorMessage(body, '')
      } catch {
        detail = raw
      }
    }
    throw new Error(detail || `WAC request failed (${res.status})`)
  }
}

export type OnboardingStatusCode =
  | 'none'
  | 'personal_provisioning'
  | 'corporate_setup_pending'
  | 'active'
  | 'join_pending'
  | 'email_verify_pending'
  | 'blocked'

export type OnboardingStatusResponse = {
  onboarding_status: OnboardingStatusCode
  active_membership_count: number
  pending_request_id?: string | null
  limited_shell_allowed?: boolean
  active_workspace_id?: string | null
}

export async function fetchOnboardingStatus(
  appId: string,
  subjectId: string,
): Promise<OnboardingStatusResponse> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/subjects/${encodeURIComponent(subjectId)}/onboarding`),
    { headers: tectonaServiceHeaders() },
  )
  if (res.status === 401) {
    throw new Error('session_expired')
  }
  if (res.status >= 500) {
    throw new Error('Onboarding status is temporarily unavailable. Please try again.')
  }
  return handleJson<OnboardingStatusResponse>(res)
}

export async function confirmEmailVerifiedOnboarding(input: {
  appId: string
  workspaceId: string
  subjectId: string
}): Promise<WacMembershipDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(input.appId)}/onboarding/confirm-email-verified`),
    {
      method: 'POST',
      headers: mutationHeaders({ actorId: input.subjectId }),
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        subject_id: input.subjectId,
      }),
    },
  )
  return handleJson<WacMembershipDto>(res)
}

export async function requestCorporateOnboardingAdminApproval(input: {
  appId: string
  workspaceId: string
  orgWorkspaceId?: string | null
  subjectId: string
  message?: string
}): Promise<OnboardingStatusResponse> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(input.appId)}/onboarding/request-admin-approval`),
    {
      method: 'POST',
      headers: mutationHeaders({ actorId: input.subjectId }),
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        org_workspace_id: input.orgWorkspaceId?.trim() || undefined,
        subject_id: input.subjectId,
        message: input.message,
      }),
    },
  )
  return handleJson<OnboardingStatusResponse>(res)
}

export async function switchCorporateOnboardingToAdminApproval(input: {
  appId: string
  workspaceId: string
  orgWorkspaceId?: string | null
  subjectId: string
  message?: string
}): Promise<OnboardingStatusResponse> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(input.appId)}/onboarding/switch-to-admin-approval`),
    {
      method: 'POST',
      headers: mutationHeaders({ actorId: input.subjectId }),
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        org_workspace_id: input.orgWorkspaceId?.trim() || undefined,
        subject_id: input.subjectId,
        message: input.message,
      }),
    },
  )
  return handleJson<OnboardingStatusResponse>(res)
}

export type AccessRequestSubmitPayload = {
  workspace_id?: string
  workspace_slug?: string
  message?: string
}

export type AccessRequestDto = {
  id: string
  app_id: string
  workspace_id: string
  subject_id: string
  status_code: 'pending' | 'approved' | 'rejected' | string
  requested_role_code?: string | null
  request_message?: string | null
  version?: number
  created_date?: string | null
  /** Legacy alias used by older callers */
  status?: 'pending' | 'approved' | 'rejected'
  message?: string | null
}

export type AccessRequestListResponse = {
  items: AccessRequestDto[]
  total: number
}

export async function submitAccessRequest(
  appId: string,
  payload: AccessRequestSubmitPayload,
  opts?: { actorId?: string; idempotencyKey?: string },
): Promise<AccessRequestDto> {
  const res = await apiFetch(wacUrl(`/v1/apps/${encodeURIComponent(appId)}/access-requests`), {
    method: 'POST',
    headers: mutationHeaders(opts),
    body: JSON.stringify(payload),
  })
  return handleJson<AccessRequestDto>(res)
}

export async function fetchWorkspaceAccessRequests(
  appId: string,
  workspaceId: string,
  params?: { status_code?: string },
): Promise<AccessRequestListResponse> {
  const q = new URLSearchParams()
  if (params?.status_code != null) q.set('status_code', params.status_code)
  const suffix = q.toString() ? `?${q}` : ''
  const res = await apiFetch(
    wacUrl(
      `/v1/apps/${encodeURIComponent(appId)}/workspaces/${encodeURIComponent(workspaceId)}/access-requests${suffix}`,
    ),
    { headers: tectonaServiceHeaders() },
  )
  return handleJson<AccessRequestListResponse>(res)
}

export async function decideAccessRequest(
  appId: string,
  requestId: string,
  payload: {
    decision: 'approve' | 'reject' | string
    reviewer_subject_id: string
    comment?: string
    grant_role_code?: string
    grant_access_tier?: 'organization_member' | 'workspace_member'
    grant_participation_scope_code?: string
  },
  opts?: { actorId?: string },
): Promise<AccessRequestDto> {
  const res = await apiFetch(
    wacUrl(`/v1/apps/${encodeURIComponent(appId)}/access-requests/${encodeURIComponent(requestId)}/decide`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    },
  )
  return handleJson<AccessRequestDto>(res)
}

export { defaultParticipationScopeCodeForUiRole as defaultParticipationScopeForUiRole } from '@/lib/workspaceParticipationScopes'
