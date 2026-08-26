/**
 * Shared authorization-policy - decisions via gateway-runtime.
 */

import { apiFetch, parseApiErrorMessage } from './httpClient'
import { serviceApiBase } from './gatewayBase'
import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'
import { readStoredTenantSelection } from '@/lib/tenantWorkspaceScope'

const AUTHZ_BASE = serviceApiBase('/api/authz')

function authzRequestInit(init?: RequestInit): RequestInit | undefined {
  const workspaceId = readStoredTenantSelection()?.workspaceId
  const scopedWorkspaceId = workspaceId && workspaceId !== '__all__' ? workspaceId : null
  const headers = new Headers(init?.headers)
  if (scopedWorkspaceId) headers.set('X-Workspace-Id', scopedWorkspaceId)
  return init || scopedWorkspaceId ? { ...init, headers } : undefined
}

async function authzFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return apiFetch(input, authzRequestInit(init))
}

export interface AuthzRoleDto {
  id: string
  role_code: string
  display_name: string
  description: string | null
  access_scope: string
  privilege: string
  status: string
  last_updated: string
  assigned_users: number
}

export interface AuthzAssignmentDto {
  id: string
  principal_sub: string
  role_id: string
  role_code: string
  role_name: string
  scope_type_code: string
  scope_id: string | null
}

/** List roles for an app from authorization-policy's admin registry (roles, not access decisions). */
export async function listAuthzRoles(appId: string = TECTONA_AUTHZ_APP_ID): Promise<AuthzRoleDto[]> {
  const workspaceId = readStoredTenantSelection()?.workspaceId
  const query = workspaceId && workspaceId !== '__all__' ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/roles${query}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `List roles failed (${res.status})`))
  }
  const body = (await res.json()) as { items: AuthzRoleDto[] }
  return body.items
}

export async function listAuthzAssignments(
  roleId?: string,
  appId: string = TECTONA_AUTHZ_APP_ID,
): Promise<AuthzAssignmentDto[]> {
  const workspaceId = readStoredTenantSelection()?.workspaceId
  const params = new URLSearchParams()
  if (roleId) params.set('role_id', roleId)
  if (workspaceId && workspaceId !== '__all__') params.set('workspace_id', workspaceId)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/assignments${query}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `List assignments failed (${res.status})`))
  }
  const body = (await res.json()) as { items: AuthzAssignmentDto[] }
  return body.items
}

export interface CreateAuthzRoleInput {
  role_code: string
  display_name: string
  description?: string
  access_scope?: string
  privilege?: string
  status?: string
}

/** Create a new role in authorization-policy's admin registry. */
export async function createAuthzRole(
  body: CreateAuthzRoleInput,
  appId: string = TECTONA_AUTHZ_APP_ID,
): Promise<{ id: string }> {
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `Create role failed (${res.status})`))
  }
  return res.json() as Promise<{ id: string }>
}

export interface UpdateAuthzRoleInput {
  display_name: string
  description?: string | null
  access_scope: string
  privilege: string
  status: string
}

/** Update an existing role's descriptive fields and lifecycle status. */
export async function updateAuthzRole(
  roleId: string,
  body: UpdateAuthzRoleInput,
  appId: string = TECTONA_AUTHZ_APP_ID,
): Promise<void> {
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/roles/${roleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `Update role failed (${res.status})`))
  }
}

/** Soft-delete a role from authorization-policy's admin registry. */
export async function deleteAuthzRole(roleId: string, appId: string = TECTONA_AUTHZ_APP_ID): Promise<void> {
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/roles/${roleId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `Delete role failed (${res.status})`))
  }
}

export interface AuthzPermissionDto {
  id: string
  permission_code: string
  resource_type: string
  action: string
  description: string | null
  ui_module: string | null
  ui_section: string | null
}

/** List the permission catalog for an app (available resource_type/action combinations). */
export async function listAuthzPermissions(appId: string = TECTONA_AUTHZ_APP_ID): Promise<AuthzPermissionDto[]> {
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/permissions`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `List permissions failed (${res.status})`))
  }
  const body = (await res.json()) as { items: AuthzPermissionDto[] }
  return body.items
}

export interface AuthzSecurityMatrixCell {
  role_code: string
  role_name: string
  permission_code: string
  resource_type: string
  action: string
  ui_module: string | null
  ui_section: string | null
}

/** Flat list of every (role, permission) pair actually granted — the real Permission Matrix. */
export async function getAuthzSecurityMatrix(
  appId: string = TECTONA_AUTHZ_APP_ID,
): Promise<AuthzSecurityMatrixCell[]> {
  const res = await authzFetch(`${AUTHZ_BASE}/v1/security-matrix?app_id=${appId}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `Get security matrix failed (${res.status})`))
  }
  const body = (await res.json()) as { cells: AuthzSecurityMatrixCell[] }
  return body.cells
}

/** Replace a role's full permission set (grid toggle sends the complete new set each time). */
export async function putAuthzRolePermissions(
  roleId: string,
  permissionIds: string[],
  appId: string = TECTONA_AUTHZ_APP_ID,
): Promise<void> {
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission_ids: permissionIds }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `Update role permissions failed (${res.status})`))
  }
}

export interface AuthzEffectivePermissionRow {
  permission_code: string
  resource_type: string
  action: string
  role_code: string
  scope_type_code: string
  scope_id: string | null
}

/** Every permission a specific user actually has, combined across all of their role assignments. */
export async function getAuthzEffectivePermissions(
  principalSub: string,
  scope = 'global',
  appId: string = TECTONA_AUTHZ_APP_ID,
): Promise<AuthzEffectivePermissionRow[]> {
  const res = await authzFetch(
    `${AUTHZ_BASE}/v1/apps/${appId}/principals/${encodeURIComponent(principalSub)}/effective?scope=${encodeURIComponent(scope)}`,
    undefined,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `Get effective permissions failed (${res.status})`))
  }
  const body = (await res.json()) as { items: AuthzEffectivePermissionRow[] }
  return body.items
}

/** Assign a principal (user) to a role at a given scope ("global", "workspace:<id>", "project:<id>"). */
export async function createAuthzAssignment(
  body: { principal_sub: string; role_id: string; scope?: string },
  appId: string = TECTONA_AUTHZ_APP_ID,
): Promise<{ id: string }> {
  const res = await authzFetch(`${AUTHZ_BASE}/v1/apps/${appId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ principal_sub: body.principal_sub, role_id: body.role_id, scope: body.scope ?? 'global' }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `Create assignment failed (${res.status})`))
  }
  return res.json() as Promise<{ id: string }>
}

export interface AuthorizeRequest {
  app_id: string
  principal: { sub: string }
  scope?: string
  resource_type: string
  resource_id?: string | null
  action: string
}

export interface AuthorizeResult {
  allowed: boolean
  reason_code: string
  matched?: {
    role_code?: string
    permission_code?: string
    scope_type?: string
  } | null
}

export async function postAuthorize(body: AuthorizeRequest): Promise<AuthorizeResult> {
  const res = await apiFetch(`${AUTHZ_BASE}/v1/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: body.app_id,
      principal: body.principal,
      scope: body.scope ?? 'global',
      resource_type: body.resource_type,
      resource_id: body.resource_id ?? null,
      action: body.action,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `authorize failed (${res.status})`)
  }
  return res.json() as Promise<AuthorizeResult>
}

export async function authorizeTectona(
  principalSub: string,
  resourceType: string,
  action: string,
  scope = 'global',
): Promise<AuthorizeResult> {
  return postAuthorize({
    app_id: TECTONA_AUTHZ_APP_ID,
    principal: { sub: principalSub },
    scope,
    resource_type: resourceType,
    action,
  })
}
