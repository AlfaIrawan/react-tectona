import fs from 'node:fs'

const wacPath = new URL('../src/lib/api/workspaceAccessControlApi.ts', import.meta.url)
const idPath = new URL('../src/lib/api/identityAdminApi.ts', import.meta.url)

const wac = `/**
 * Workspace Access Control (shared WAC) API client.
 * Backend: python-workspace-access-control-service-fastapi (port 8421).
 */

import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'

import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

export const TECTONA_WAC_APP_ID = TECTONA_AUTHZ_APP_ID

const BASE_URL =
  (import.meta.env.VITE_WORKSPACE_ACCESS_CONTROL_API_URL as string | undefined)?.trim()?.replace(/\\/$/, '') ||
  (import.meta.env.DEV ? '/api/workspace-access-control' : serviceApiBase('/api/workspace-access-control'))

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
}

export type WacMembershipPatchPayload = {
  role_code?: string
  status_code?: string
  version?: number
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let detail = ''
    if (raw) {
      try {
        const body = JSON.parse(raw) as Record<string, unknown>
        if (typeof body?.detail === 'string') detail = body.detail
        else if (Array.isArray(body?.detail))
          detail = body.detail.map((x: { msg?: string }) => x?.msg ?? JSON.stringify(x)).join('; ')
        else if (body?.detail != null) detail = JSON.stringify(body.detail)
      } catch {
        detail = raw
      }
    }
    throw new Error(detail || \`HTTP \${res.status}\`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function wacUrl(path: string): string {
  const base = BASE_URL.replace(/\\/$/, '')
  const p = path.startsWith('/') ? path : \`/\${path}\`
  if (!base) return p
  return \`\${base}\${p}\`
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

export async function fetchWorkspaceMembers(
  appId: string,
  workspaceId: string
): Promise<WacMemberListResponse> {
  const res = await apiFetch(
    wacUrl(\`/v1/apps/\${encodeURIComponent(appId)}/workspaces/\${encodeURIComponent(workspaceId)}/members\`),
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
    wacUrl(\`/v1/apps/\${encodeURIComponent(appId)}/workspaces/\${encodeURIComponent(workspaceId)}/memberships\`),
    {
      method: 'POST',
      headers: mutationHeaders(opts),
      body: JSON.stringify({
        subject_id: payload.subject_id,
        role_code: payload.role_code,
        status_code: payload.status_code ?? 'active',
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
    wacUrl(\`/v1/apps/\${encodeURIComponent(appId)}/memberships/\${encodeURIComponent(membershipId)}\`),
    {
      method: 'PATCH',
      headers: mutationHeaders(opts),
      body: JSON.stringify(payload),
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
    wacUrl(\`/v1/apps/\${encodeURIComponent(appId)}/memberships/\${encodeURIComponent(membershipId)}\`),
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

export function defaultParticipationScopeForUiRole(role: WorkspaceMemberUiRole): string {
  switch (role) {
    case 'Admin':
      return 'All projects'
    case 'Manager':
      return 'Program only'
    case 'Viewer':
      return 'Read-only workspace'
    default:
      return 'Assigned projects'
  }
}
`

const id = `/**
 * Identity Lite admin API — user directory for workspace membership enrichment.
 */

import { IDENTITY_API_BASE } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

export type IdentityUserDto = {
  id: string
  email: string
  display_name: string
  status_code: string
  tenant_id?: string | null
  created_date?: string
}

export type IdentityUserListResponse = {
  items: IdentityUserDto[]
  limit: number
  offset: number
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    throw new Error(raw || \`HTTP \${res.status}\`)
  }
  return res.json() as Promise<T>
}

export async function fetchIdentityUsers(params?: {
  limit?: number
  offset?: number
}): Promise<IdentityUserListResponse> {
  const limit = params?.limit ?? 200
  const offset = params?.offset ?? 0
  const base = IDENTITY_API_BASE.replace(/\\/$/, '')
  const res = await apiFetch(\`\${base}/api/identity-lite/v1/users?limit=\${limit}&offset=\${offset}\`, {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<IdentityUserListResponse>(res)
}
`

fs.writeFileSync(wacPath, wac, 'utf8')
fs.writeFileSync(idPath, id, 'utf8')
console.log('fixed encoding')
