/**
 * Workspace governance assignment + compliance API.
 * Namespace: /api/workspace-governance/v1
 */

import type { GovernanceCatalogSnapshot } from '@/lib/api/governanceConfigurationApi'

import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase('/api/workspace-governance', import.meta.env.VITE_WORKSPACE_GOVERNANCE_API_URL)

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
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function apiUrl(path: string): string {
  const base = BASE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

export type WorkspaceGovernanceAssignmentDto = {
  workspace_id: string
  governance_template_id: string | null
  workflow_policy_id: string | null
  sla_policy_id: string | null
  naming_convention_id: string | null
  approval_policy_id: string | null
  governance_owner: string | null
  last_review: string | null
  compliance_score_cached: string | null
  compliance_posture: string | null
  row_version: number
}

export type WorkspaceGovernanceAssignmentListResponse = {
  items: WorkspaceGovernanceAssignmentDto[]
}

export type WorkspaceGovernanceAssignmentPutPayload = {
  governance_template_id: string | null
  workflow_policy_id: string | null
  sla_policy_id: string | null
  naming_convention_id: string | null
  approval_policy_id: string | null
  governance_owner?: string | null
  last_review?: string | null
}

export async function fetchWorkspaceGovernanceAssignments(): Promise<WorkspaceGovernanceAssignmentListResponse> {
  const res = await apiFetch(apiUrl('/v1/assignments'))
  return handleJson(res)
}

export async function fetchWorkspaceGovernanceAssignmentByWorkspaceId(
  workspaceId: string
): Promise<WorkspaceGovernanceAssignmentDto> {
  const res = await apiFetch(apiUrl(`/v1/workspaces/${workspaceId}/assignment`))
  return handleJson(res)
}

export async function putWorkspaceGovernanceAssignment(
  workspaceId: string,
  body: WorkspaceGovernanceAssignmentPutPayload
): Promise<WorkspaceGovernanceAssignmentDto> {
  const res = await apiFetch(apiUrl(`/v1/workspaces/${workspaceId}/assignment`), {
    method: 'PUT',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return handleJson(res)
}

export async function postApplyGovernanceTemplate(
  workspaceId: string,
  governanceTemplateId: string
): Promise<WorkspaceGovernanceAssignmentDto> {
  const res = await apiFetch(apiUrl(`/v1/workspaces/${workspaceId}/apply-template`), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ governance_template_id: governanceTemplateId }),
  })
  return handleJson(res)
}

export type WorkspaceComplianceDto = {
  workspace_id: string
  compliance_score: string
  compliance_posture: string
  checks: Array<{
    rule_code: string
    rule_dimension: string
    satisfied: boolean
    weight: string
    contribution: string
  }>
  resolved: Record<string, string>
}

export type WorkspaceActivityEventDto = {
  id: string
  timestamp: string
  actor: string
  event: string
  target: string
  scope: string
}

export type WorkspaceActivityListResponse = {
  items: WorkspaceActivityEventDto[]
}

export type WorkspaceActivityCreatePayload = {
  event: string
  target: string
  scope?: string
}

export async function fetchWorkspaceActivity(limit = 50, actor?: string): Promise<WorkspaceActivityListResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (actor?.trim()) params.set('actor', actor.trim())
  const res = await apiFetch(apiUrl(`/v1/activity?${params.toString()}`))
  return handleJson(res)
}

export async function postWorkspaceActivityEvent(payload: WorkspaceActivityCreatePayload): Promise<WorkspaceActivityEventDto> {
  const res = await apiFetch(apiUrl('/v1/activity/events'), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      event: payload.event,
      target: payload.target,
      scope: payload.scope ?? 'workspace_activity',
    }),
  })
  return handleJson(res)
}

export async function fetchWorkspaceCompliance(workspaceId: string): Promise<WorkspaceComplianceDto> {
  const res = await apiFetch(apiUrl(`/v1/workspaces/${workspaceId}/compliance`))
  return handleJson(res)
}

function findName(items: { id: string; name: string }[], id: string | null): string {
  if (!id) return ''
  return items.find((x) => x.id === id)?.name ?? ''
}

/** Merge managed assignment (IDs + catalog) over legacy metadata-derived governance for UI. */
export function applyManagedGovernanceToRecord<T extends { governance: WorkspaceRecordGovernanceLike }>(
  base: T,
  assignment: WorkspaceGovernanceAssignmentDto | undefined,
  catalogs: GovernanceCatalogSnapshot | null
): T {
  if (!assignment || !catalogs) return base
  const score =
    assignment.compliance_score_cached != null && assignment.compliance_score_cached !== ''
      ? Number(assignment.compliance_score_cached)
      : null
  const templateName = findName(catalogs.templates, assignment.governance_template_id)
  const workflowName = findName(catalogs.workflowPolicies, assignment.workflow_policy_id)
  const slaName = findName(catalogs.slaPolicies, assignment.sla_policy_id)
  const namingName = findName(catalogs.namingConventions, assignment.naming_convention_id)
  const approvalName = findName(catalogs.approvalPolicies, assignment.approval_policy_id)

  const gov = {
    ...base.governance,
    template: templateName || base.governance.template,
    workflowPolicy: workflowName || base.governance.workflowPolicy,
    namingPolicy: namingName || base.governance.namingPolicy,
    slaPolicy: slaName || base.governance.slaPolicy,
    approvalPolicy: approvalName || base.governance.approvalPolicy,
    governanceOwner: assignment.governance_owner?.trim()
      ? assignment.governance_owner
      : base.governance.governanceOwner,
    lastReview: assignment.last_review?.trim()
      ? assignment.last_review.slice(0, 10)
      : base.governance.lastReview,
    complianceScore: Number.isFinite(score as number) ? (score as number) : base.governance.complianceScore,
    complianceStatus: mapPostureToComplianceStatus(assignment.compliance_posture, base.governance.complianceStatus),
    policyStatus: derivePolicyStatus(assignment.compliance_posture, base.governance.policyStatus),
    configurationStatus: deriveConfigurationStatus(assignment),
  }
  return { ...base, governance: gov, governanceSource: 'managed' as const } as T
}

type WorkspaceRecordGovernanceLike = {
  template: string
  workflowPolicy: string
  namingPolicy: string
  slaPolicy: string
  approvalPolicy: string
  complianceStatus: string
  policyStatus: string | null
  governanceOwner: string
  lastReview: string
  complianceScore: number | null
  configurationStatus: string
}

function mapPostureToComplianceStatus(
  posture: string | null,
  legacy: string
): 'Compliant' | 'Needs Review' | 'Non-Compliant' | 'Unconfigured' {
  if (!posture || posture === 'UNCONFIGURED') {
    return legacy as 'Compliant' | 'Needs Review' | 'Non-Compliant' | 'Unconfigured'
  }
  if (posture === 'FULL') return 'Compliant'
  if (posture === 'PARTIAL') return 'Needs Review'
  return 'Non-Compliant'
}

function derivePolicyStatus(
  posture: string | null,
  legacy: string | null
): 'Governed' | 'Draft Policy' | 'Non-Compliant' | 'Deprecated' | null {
  if (!posture || posture === 'UNCONFIGURED') {
    return legacy as 'Governed' | 'Draft Policy' | 'Non-Compliant' | 'Deprecated' | null
  }
  if (posture === 'FULL') return 'Governed'
  if (posture === 'PARTIAL') return 'Draft Policy'
  if (posture === 'CRITICAL') return 'Non-Compliant'
  return legacy as 'Governed' | 'Draft Policy' | 'Non-Compliant' | 'Deprecated' | null
}

function deriveConfigurationStatus(
  a: WorkspaceGovernanceAssignmentDto
): 'Governed' | 'Partial' | 'Unconfigured' | 'Non-Compliant' {
  const filled = [
    a.governance_template_id,
    a.workflow_policy_id,
    a.sla_policy_id,
    a.naming_convention_id,
    a.approval_policy_id,
  ].filter(Boolean).length
  if (filled === 0) return 'Unconfigured'
  if (filled === 5) return 'Governed'
  if (a.compliance_posture === 'CRITICAL') return 'Non-Compliant'
  return 'Partial'
}
