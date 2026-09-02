/**
 * Workspace Org API — directory organizations/workspaces (port 8424) + onboarding P0 helpers.
 */

import { apiFetch, tectonaServiceHeaders } from './httpClient'
import type { TenantMode } from '@/lib/onboardingFeature'

/** Same-origin nginx → workspace-org :8424. Do not fall back to gateway-runtime. */
const BASE_URL =
  (import.meta.env.VITE_WORKSPACE_ORG_API_URL as string | undefined)?.trim()?.replace(/\/$/, '')
  || '/api/workspace-org'

function workspaceOrgWebSocketBaseUrl(): string {
  const override = (import.meta.env.VITE_WORKSPACE_ORG_API_URL as string | undefined)?.replace(/\/$/, '')
  if (override) return override
  return '/api/workspace-org'
}

/** Dev: WS uses Vite proxy `/api/workspace-org` → workspace-org :8424. */
export function createWorkspaceOrgEventsWebSocketUrl(options?: { token?: string }): string {
  const rawBase = workspaceOrgWebSocketBaseUrl()
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

function orgUrl(path: string): string {
  const base = BASE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let detail = raw
    if (raw) {
      try {
        const body = JSON.parse(raw) as {
          detail?: string | { msg?: string }[] | Record<string, unknown>
          error?: { message?: string } | string
        }
        if (typeof body.detail === 'string') detail = body.detail
        else if (Array.isArray(body.detail))
          detail = body.detail.map((x) => x?.msg ?? JSON.stringify(x)).join('; ')
        else if (body.detail != null) detail = JSON.stringify(body.detail)
        else if (body.error && typeof body.error === 'object' && body.error.message)
          detail = String(body.error.message)
        else if (typeof body.error === 'string') detail = body.error
      } catch {
        /* use raw */
      }
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
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

export type WorkspaceOrgOrganizationDto = {
  id: string
  organization_code: string
  name: string
  description?: string | null
  status_code: string
  /** personal = onboarding wrapper for a single-user workspace; organization = corporate directory. */
  organization_type?: 'personal' | 'organization' | string | null
  metadata?: Record<string, unknown> | null
  verified_domains?: VerifiedDomainEntry[]
  version: number
  created_date?: string
  updated_date?: string
}

export type VerifiedDomainCategory = 'email' | 'local'

export type VerifiedDomainEntry = {
  value: string
  category: VerifiedDomainCategory
  verified?: boolean
}

export type WorkspaceOrgOrganizationListResponse = {
  items: WorkspaceOrgOrganizationDto[]
  total: number
  page?: number
  page_size?: number
}

export type WorkspaceOrgWorkspaceDto = {
  id: string
  organization_id: string
  organization_code?: string | null
  organization_name?: string | null
  workspace_key: string
  name: string
  description?: string | null
  status_code: string
  slug?: string | null
  tenant_mode?: TenantMode | null
  metadata?: Record<string, unknown> | null
  version: number
  created_by?: string | null
  created_date?: string
  updated_date?: string
}

export type WorkspaceOrgWorkspaceListResponse = {
  items: WorkspaceOrgWorkspaceDto[]
  total: number
  page?: number
  page_size?: number
}

export type WorkspaceOrgDirectoryTreePersonalHost = {
  host_workspace_id: string
  role_code: string
}

export type WorkspaceOrgDirectoryTreePersonalLink = {
  workspace_id: string
  hide_canonical: boolean
  hosts: WorkspaceOrgDirectoryTreePersonalHost[]
}

export type WorkspaceOrgDirectoryTreeRow = {
  workspace_id: string
  workspace_key: string
  name: string
  depth: number
  tree_parent_id?: string | null
  kind: 'canonical' | 'membership'
  role_code?: string | null
}

export type WorkspaceOrgDirectoryTreeDto = {
  organization_id: string
  app_id: string
  memberships_included: boolean
  canonical_parent_by_workspace_id: Record<string, string | null>
  personal_links: WorkspaceOrgDirectoryTreePersonalLink[]
  rows: WorkspaceOrgDirectoryTreeRow[]
}

export type WorkspaceOrgWorkspaceTypeDto = {
  id: string
  type_code: string
  label: string
  sort_order: number
  is_active: boolean
  version: number
}

export type WorkspaceOrgWorkspaceTypeListResponse = {
  items: WorkspaceOrgWorkspaceTypeDto[]
  total: number
}

export type SlugAvailabilityResponse = {
  available: boolean
  reason?: string | null
}

export type SlugResolveResponse = {
  workspace_id: string
  org_id: string
  tenant_mode: TenantMode
  display_name: string
  slug: string
}

export type PersonalWorkspaceCreatePayload = {
  display_name: string
  slug: string
  app_id: string
  /** When true, keep WAC onboarding gated until corporate wizard finishes (step 2+). */
  corporate_onboarding?: boolean
}

export type PersonalWorkspaceResponse = {
  organization_id: string
  workspace_id: string
  slug: string
  tenant_mode: TenantMode
  display_name: string
}

export type DomainResolveResponse = {
  email_domain: string
  matched: boolean
  organization_id?: string | null
  organization_code?: string | null
  organization_name?: string | null
  default_workspace_id?: string | null
  default_workspace_slug?: string | null
  default_workspace_name?: string | null
  can_create_workspace?: boolean
}

export type CorporateOnboardingProgress = {
  matched: boolean
  organization_id?: string | null
  default_workspace_id?: string | null
  org_workspace_joined: boolean
  personal_workspace_created: boolean
  personal_workspace_id?: string | null
  requires_corporate_setup: boolean
  setup_phase: 'none' | 'personal' | 'optional_join' | 'email_verify'
}

const DEFAULT_CORPORATE_PROGRESS: CorporateOnboardingProgress = {
  matched: false,
  organization_id: null,
  default_workspace_id: null,
  org_workspace_joined: false,
  personal_workspace_created: false,
  personal_workspace_id: null,
  requires_corporate_setup: false,
  setup_phase: 'none',
}

function corporateProgressFromDomainResolve(
  resolved: DomainResolveResponse,
): CorporateOnboardingProgress {
  if (!resolved.matched) return { ...DEFAULT_CORPORATE_PROGRESS }
  return {
    matched: true,
    organization_id: resolved.organization_id ?? null,
    default_workspace_id: resolved.default_workspace_id ?? null,
    org_workspace_joined: false,
    personal_workspace_created: false,
    personal_workspace_id: null,
    requires_corporate_setup: true,
    setup_phase: 'personal' as const,
  }
}

export type DomainHomeResponse = {
  organization_id: string
  workspace_id: string
  slug: string
  tenant_mode: TenantMode
  display_name: string
  organization_code: string
  organization_name: string
  membership_role?: string
  onboarding_status?: string
  email_verification_sent?: boolean
}

export type CorporateWorkspaceCreatePayload = {
  organization_id: string
  display_name: string
  slug: string
  app_id: string
}

export type CorporateWorkspaceResponse = {
  organization_id: string
  workspace_id: string
  slug: string
  tenant_mode: TenantMode
  display_name: string
  organization_code: string
  organization_name: string
}

export async function fetchWorkspaceOrgOrganizations(params?: {
  page?: number
  page_size?: number
  status_code?: string
  /** Prefer `organization` for Primary organization pickers (excludes personal onboarding orgs). */
  organization_type?: 'personal' | 'organization'
}): Promise<WorkspaceOrgOrganizationListResponse> {
  const q = new URLSearchParams()
  if (params?.page != null) q.set('page', String(params.page))
  if (params?.page_size != null) q.set('page_size', String(params.page_size))
  if (params?.status_code) q.set('status', params.status_code)
  if (params?.organization_type) q.set('organization_type', params.organization_type)
  const suffix = q.toString() ? `?${q}` : ''
  const res = await apiFetch(orgUrl(`/v1/organizations${suffix}`), {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<WorkspaceOrgOrganizationListResponse>(res)
}

export async function createWorkspaceOrgOrganization(
  payload: {
    organization_code: string
    name: string
    description?: string | null
    status_code?: string
    metadata?: Record<string, unknown>
    verified_domains?: VerifiedDomainEntry[]
  },
  opts?: { actorId?: string; idempotencyKey?: string },
): Promise<WorkspaceOrgOrganizationDto> {
  const res = await apiFetch(orgUrl('/v1/organizations'), {
    method: 'POST',
    headers: mutationHeaders(opts),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgOrganizationDto>(res)
}

export async function patchWorkspaceOrgOrganization(
  organizationId: string,
  payload: {
    name?: string
    description?: string | null
    status_code?: string
    metadata?: Record<string, unknown>
    verified_domains?: VerifiedDomainEntry[]
    version?: number
  },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgOrganizationDto> {
  const res = await apiFetch(orgUrl(`/v1/organizations/${encodeURIComponent(organizationId)}`), {
    method: 'PATCH',
    headers: mutationHeaders(opts),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgOrganizationDto>(res)
}

export async function fetchWorkspaceOrgWorkspaces(params?: {
  page?: number
  page_size?: number
  organization_id?: string
  status_code?: string
  include_archived?: boolean
}): Promise<WorkspaceOrgWorkspaceListResponse> {
  const q = new URLSearchParams()
  if (params?.page != null) q.set('page', String(params.page))
  if (params?.page_size != null) q.set('page_size', String(params.page_size))
  if (params?.organization_id) q.set('organization_id', params.organization_id)
  if (params?.status_code) q.set('status_code', params.status_code)
  if (params?.include_archived) q.set('include_archived', 'true')
  const suffix = q.toString() ? `?${q}` : ''
  const res = await apiFetch(orgUrl(`/v1/workspaces${suffix}`), {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<WorkspaceOrgWorkspaceListResponse>(res)
}

/** Directory memberships for a concrete workspace, used to scope invite candidates. */
export async function fetchWorkspaceOrgMemberships(workspaceId: string): Promise<WorkspaceOrgMembershipDto[]> {
  const id = workspaceId.trim()
  if (!id) return []
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(id)}/memberships`),
    { headers: tectonaServiceHeaders() },
  )
  return handleJson<WorkspaceOrgMembershipDto[]>(res)
}

/** Fetch all workspace rows (paginated server-side until exhausted). */
export async function fetchAllWorkspaceOrgWorkspaces(): Promise<WorkspaceOrgWorkspaceDto[]> {
  const pageSize = 200
  let page = 1
  const all: WorkspaceOrgWorkspaceDto[] = []
  for (;;) {
    // Archived workspaces are soft-deleted, not gone -- the Directory tree needs them
    // present so children keep their real structural parent (and a real Lifecycle
    // status to display), instead of silently falling back elsewhere once archived.
    const res = await fetchWorkspaceOrgWorkspaces({ page, page_size: pageSize, include_archived: true })
    all.push(...(res.items ?? []))
    if (all.length >= (res.total ?? 0) || (res.items?.length ?? 0) < pageSize) break
    page += 1
  }
  return all
}

export async function fetchOrganizationDirectoryTree(
  organizationId: string,
  opts?: { includeArchived?: boolean; appId?: string },
): Promise<WorkspaceOrgDirectoryTreeDto> {
  const id = organizationId.trim()
  const q = new URLSearchParams()
  if (opts?.includeArchived) q.set('include_archived', 'true')
  if (opts?.appId?.trim()) q.set('app_id', opts.appId.trim())
  const suffix = q.toString() ? `?${q}` : ''
  const res = await apiFetch(
    orgUrl(`/v1/organizations/${encodeURIComponent(id)}/directory-tree${suffix}`),
    { headers: tectonaServiceHeaders() },
  )
  return handleJson<WorkspaceOrgDirectoryTreeDto>(res)
}

export async function createWorkspaceOrgWorkspace(
  payload: {
    organization_id: string
    workspace_key: string
    name: string
    description?: string | null
    status_code?: string
    metadata?: Record<string, unknown>
  },
  opts?: { actorId?: string; idempotencyKey?: string },
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(orgUrl('/v1/workspaces'), {
    method: 'POST',
    headers: mutationHeaders(opts),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function fetchWorkspaceOrgWorkspaceById(
  workspaceId: string,
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(orgUrl(`/v1/workspaces/${encodeURIComponent(workspaceId)}`), {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function patchWorkspaceOrgWorkspace(
  workspaceId: string,
  payload: {
    name?: string
    description?: string | null
    status_code?: string
    metadata?: Record<string, unknown>
    version: number
  },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(orgUrl(`/v1/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: 'PATCH',
    headers: mutationHeaders(opts),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function patchWorkspaceOrgDirectoryParent(
  workspaceId: string,
  payload: { parent_workspace_id: string | null; version: number },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(workspaceId)}/directory-parent`),
    {
      method: 'PATCH',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    },
  )
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function deleteWorkspaceOrgWorkspace(
  workspaceId: string,
  opts?: { actorId?: string; mode?: 'archive' | 'purge'; force?: boolean; version?: number },
): Promise<void> {
  const q = new URLSearchParams()
  if (opts?.mode) q.set('mode', opts.mode)
  if (opts?.force) q.set('force', 'true')
  if (opts?.version != null) q.set('version', String(opts.version))
  const query = q.toString()
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(workspaceId)}${query ? `?${query}` : ''}`),
    {
      method: 'DELETE',
      headers: mutationHeaders(opts),
    },
  )
  await handleJson<void>(res)
}

export type IdentityOwnedWorkspacesPurgeResponse = {
  identity_ref: string
  purged_count: number
  workspace_ids: string[]
}

/** Permanently delete workspaces owned by identity — frees slug for Sign up / onboarding. */
export async function purgeOwnedWorkspacesForIdentity(
  identityRef: string,
  opts?: { actorId?: string; correlationId?: string },
): Promise<IdentityOwnedWorkspacesPurgeResponse> {
  const res = await apiFetch(
    orgUrl(`/v1/identities/${encodeURIComponent(identityRef.trim())}/owned-workspaces`),
    {
      method: 'DELETE',
      headers: mutationHeaders(opts),
    },
  )
  return handleJson<IdentityOwnedWorkspacesPurgeResponse>(res)
}

export async function fetchWorkspaceOrgWorkspaceTypes(): Promise<WorkspaceOrgWorkspaceTypeListResponse> {
  const res = await apiFetch(orgUrl('/v1/workspace-types'), {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<WorkspaceOrgWorkspaceTypeListResponse>(res)
}

export async function createWorkspaceOrgWorkspaceType(
  payload: { type_code: string; label: string; sort_order?: number; is_active?: boolean },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceTypeDto> {
  const res = await apiFetch(orgUrl('/v1/workspace-types'), {
    method: 'POST',
    headers: mutationHeaders(opts),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgWorkspaceTypeDto>(res)
}

export async function patchWorkspaceOrgWorkspaceType(
  typeId: string,
  payload: { label?: string; sort_order?: number; is_active?: boolean; version?: number },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceTypeDto> {
  const res = await apiFetch(orgUrl(`/v1/workspace-types/${encodeURIComponent(typeId)}`), {
    method: 'PATCH',
    headers: mutationHeaders(opts),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgWorkspaceTypeDto>(res)
}

export async function deleteWorkspaceOrgWorkspaceType(typeId: string, opts?: { actorId?: string }): Promise<void> {
  const res = await apiFetch(orgUrl(`/v1/workspace-types/${encodeURIComponent(typeId)}`), {
    method: 'DELETE',
    headers: mutationHeaders(opts),
  })
  await handleJson<void>(res)
}

export type WorkspaceOrgMembershipDto = {
  id: string
  workspace_id: string
  workspace_key: string
  workspace_name: string
  identity_ref: string
  role_code: string
  status_code: string
  version: number
  created_date?: string
  updated_date?: string | null
}

export type IdentityWorkspaceOrgMembershipDto = {
  workspace_id: string
  workspace_key: string
  workspace_name: string
  organization_id: string
  organization_code: string
  organization_name: string
  role_code: string
  membership_status_code: string
  is_default: boolean
}

export async function fetchIdentityWorkspaceOrgMemberships(
  identityRef: string,
): Promise<IdentityWorkspaceOrgMembershipDto[]> {
  const res = await apiFetch(
    orgUrl(`/v1/identities/${encodeURIComponent(identityRef.trim())}/workspaces`),
    { headers: tectonaServiceHeaders() },
  )
  return handleJson<IdentityWorkspaceOrgMembershipDto[]>(res)
}

// --- Onboarding P0 ---

export async function checkSlugAvailability(slug: string): Promise<SlugAvailabilityResponse> {
  const res = await apiFetch(
    orgUrl(`/v1/slugs/${encodeURIComponent(slug)}/availability`),
    { headers: tectonaServiceHeaders() },
  )
  return handleJson<SlugAvailabilityResponse>(res)
}

export async function resolveSlug(slug: string): Promise<SlugResolveResponse> {
  const res = await apiFetch(
    orgUrl(`/v1/slugs/${encodeURIComponent(slug)}/resolve`),
    { headers: tectonaServiceHeaders() },
  )
  return handleJson<SlugResolveResponse>(res)
}

export async function createPersonalWorkspace(
  payload: PersonalWorkspaceCreatePayload,
): Promise<PersonalWorkspaceResponse> {
  const res = await apiFetch(orgUrl('/v1/onboarding/personal-workspace'), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleJson<PersonalWorkspaceResponse>(res)
}

export type IdentityWorkspaceRepairPayload = {
  identityRef: string
  ownerEmail: string
  displayName: string
  slug: string
  appId: string
}

export type IdentityWorkspaceRepairResponse = {
  organization_id: string
  workspace_id: string
  slug: string
  tenant_mode: TenantMode
  display_name: string
  organization_name?: string
}

export async function repairIdentityWorkspace(
  payload: IdentityWorkspaceRepairPayload,
  opts?: { actorId?: string },
): Promise<IdentityWorkspaceRepairResponse> {
  const headers = tectonaServiceHeaders()
  if (opts?.actorId?.trim()) headers['X-Actor-Id'] = opts.actorId.trim()
  const res = await apiFetch(orgUrl('/v1/admin/identity-workspace-repair'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      identity_ref: payload.identityRef,
      owner_email: payload.ownerEmail,
      display_name: payload.displayName,
      slug: payload.slug,
      app_id: payload.appId,
    }),
  })
  return handleJson<IdentityWorkspaceRepairResponse>(res)
}

export async function resolveOrganizationByEmail(email: string): Promise<DomainResolveResponse> {
  const q = new URLSearchParams({ email: email.trim().toLowerCase() })
  const res = await apiFetch(orgUrl(`/v1/onboarding/domain-resolve?${q}`), {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<DomainResolveResponse>(res)
}

export async function fetchCorporateOnboardingProgress(
  email: string,
  appId: string,
): Promise<CorporateOnboardingProgress> {
  const q = new URLSearchParams({
    email: email.trim().toLowerCase(),
    app_id: appId,
  })
  const res = await apiFetch(orgUrl(`/v1/onboarding/corporate-progress?${q}`), {
    headers: tectonaServiceHeaders(),
  })
  if (res.status === 401 || res.status === 404 || res.status >= 500) {
    const resolved = await resolveOrganizationByEmail(email)
    return corporateProgressFromDomainResolve(resolved)
  }
  return handleJson<CorporateOnboardingProgress>(res)
}

export async function domainHomeOnboarding(
  appId: string,
  email: string,
  opts?: { deferVerificationEmail?: boolean },
): Promise<DomainHomeResponse> {
  const q = new URLSearchParams({ email: email.trim().toLowerCase() })
  const res = await apiFetch(orgUrl(`/v1/onboarding/domain-home?${q}`), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      app_id: appId,
      defer_verification_email: opts?.deferVerificationEmail === true,
    }),
  })
  return handleJson<DomainHomeResponse>(res)
}

export async function sendDomainHomeVerification(
  appId: string,
  email: string,
  workspaceId: string,
): Promise<{ email_verification_sent: boolean }> {
  const q = new URLSearchParams({ email: email.trim().toLowerCase() })
  const res = await apiFetch(orgUrl(`/v1/onboarding/domain-home/send-verification?${q}`), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ app_id: appId, workspace_id: workspaceId }),
  })
  return handleJson<{ email_verification_sent: boolean }>(res)
}

export async function createCorporateWorkspaceOnboarding(
  email: string,
  payload: CorporateWorkspaceCreatePayload,
): Promise<CorporateWorkspaceResponse> {
  const q = new URLSearchParams({ email: email.trim().toLowerCase() })
  const res = await apiFetch(orgUrl(`/v1/onboarding/corporate-workspace?${q}`), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleJson<CorporateWorkspaceResponse>(res)
}

export type OrgPersonalWorkspaceCreatePayload = {
  organization_id: string
  display_name: string
  slug: string
  app_id: string
  corporate_onboarding?: boolean
  defer_org_tree_link?: boolean
}

export type OrgPersonalWorkspaceResponse = {
  organization_id: string
  workspace_id: string
  slug: string
  tenant_mode: TenantMode
  display_name: string
  organization_code: string
  organization_name: string
}

export async function createOrgPersonalWorkspaceOnboarding(
  email: string,
  payload: OrgPersonalWorkspaceCreatePayload,
): Promise<OrgPersonalWorkspaceResponse> {
  const q = new URLSearchParams({ email: email.trim().toLowerCase() })
  const res = await apiFetch(orgUrl(`/v1/onboarding/org-personal-workspace?${q}`), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      ...payload,
      corporate_onboarding: payload.corporate_onboarding ?? true,
    }),
  })
  return handleJson<OrgPersonalWorkspaceResponse>(res)
}

export type WorkspaceDirectoryMembershipEnsurePayload = {
  identity_ref: string
  role_code?: 'owner' | 'admin' | 'member' | 'viewer'
  status_code?: 'active' | 'invited' | 'suspended' | 'revoked'
}

export type WorkspaceDirectoryMembershipDto = {
  id: string
  workspace_id: string
  workspace_key: string
  workspace_name: string
  identity_ref: string
  role_code: string
  status_code: string
  version: number
}

export async function deferPersonalWorkspaceForAdminApproval(
  personalWorkspaceId: string,
  payload: { identity_ref: string; org_workspace_id?: string | null },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(personalWorkspaceId)}/defer-admin-approval`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    },
  )
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function completePersonalWorkspaceAfterAdminApproval(
  personalWorkspaceId: string,
  payload: { identity_ref: string; org_workspace_id?: string | null },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(personalWorkspaceId)}/complete-admin-approval`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    },
  )
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function linkPersonalWorkspaceToOrgTree(
  orgWorkspaceId: string,
  payload: { identity_ref: string; personal_workspace_id?: string | null },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(orgWorkspaceId)}/link-org-tree`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    },
  )
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function unlinkPersonalWorkspaceFromOrgTree(
  personalWorkspaceId: string,
  payload: { identity_ref: string },
  opts?: { actorId?: string },
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(personalWorkspaceId)}/unlink-org-tree`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    },
  )
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function ensureWorkspaceDirectoryMembership(
  workspaceId: string,
  payload: WorkspaceDirectoryMembershipEnsurePayload,
  opts?: { actorId?: string },
): Promise<WorkspaceDirectoryMembershipDto> {
  const res = await apiFetch(
    orgUrl(`/v1/workspaces/${encodeURIComponent(workspaceId)}/memberships/ensure`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
    },
  )
  return handleJson<WorkspaceDirectoryMembershipDto>(res)
}
