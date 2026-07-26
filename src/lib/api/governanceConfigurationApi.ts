/**
 * Governance Configuration Center API (python-workspace-governance-service-fastapi).
 * Namespace: /api/governance-config/v1
 */

import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase(
  '/api/governance-config',
  import.meta.env.VITE_GOVERNANCE_CONFIG_API_URL ?? '/api/governance-config',
)

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

function url(path: string): string {
  const base = BASE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

export type CatalogItemDto = {
  id: string
  code: string
  name: string
  description: string | null
  rule_regex?: string | null
  created_date?: string | null
  updated_date?: string | null
}

export type GovernanceTemplateDto = CatalogItemDto & {
  version: number
  status: string
  default_workflow_policy_id: string | null
  default_sla_policy_id: string | null
  default_naming_convention_id: string | null
  default_approval_policy_id: string | null
  created_date?: string | null
  updated_date?: string | null
}

export type ComplianceRuleDto = {
  id: string
  code: string
  title: string
  description: string | null
  rule_dimension: string
  weight: string
  is_active: boolean
}

export type GovernanceCatalogSnapshot = {
  templates: GovernanceTemplateDto[]
  workflowPolicies: CatalogItemDto[]
  slaPolicies: CatalogItemDto[]
  namingConventions: CatalogItemDto[]
  approvalPolicies: CatalogItemDto[]
  complianceRules: ComplianceRuleDto[]
}

export type GovernanceTemplateCreatePayload = {
  code: string
  name: string
  description?: string | null
  status?: 'draft' | 'published' | 'deprecated'
  default_workflow_policy_id?: string | null
  default_sla_policy_id?: string | null
  default_naming_convention_id?: string | null
  default_approval_policy_id?: string | null
}

type PolicyCreatePayload = {
  code: string
  name: string
  description?: string | null
  rule_regex?: string | null
}

export async function fetchGovernanceCatalogSnapshot(): Promise<GovernanceCatalogSnapshot> {
  const [
    templatesRes,
    wfRes,
    slaRes,
    namingRes,
    apprRes,
    rulesRes,
  ] = await Promise.all([
    apiFetch(url('/v1/templates')),
    apiFetch(url('/v1/workflow-policies')),
    apiFetch(url('/v1/sla-policies')),
    apiFetch(url('/v1/naming-conventions')),
    apiFetch(url('/v1/approval-policies')),
    apiFetch(url('/v1/compliance-rules')),
  ])
  const [templatesBody, wfBody, slaBody, namingBody, apprBody, rulesBody] = await Promise.all([
    handleJson<{ items: GovernanceTemplateDto[] }>(templatesRes),
    handleJson<{ items: CatalogItemDto[] }>(wfRes),
    handleJson<{ items: CatalogItemDto[] }>(slaRes),
    handleJson<{ items: CatalogItemDto[] }>(namingRes),
    handleJson<{ items: CatalogItemDto[] }>(apprRes),
    handleJson<{ items: ComplianceRuleDto[] }>(rulesRes),
  ])
  return {
    templates: templatesBody.items ?? [],
    workflowPolicies: wfBody.items ?? [],
    slaPolicies: slaBody.items ?? [],
    namingConventions: namingBody.items ?? [],
    approvalPolicies: apprBody.items ?? [],
    complianceRules: rulesBody.items ?? [],
  }
}

export async function createGovernanceTemplate(
  payload: GovernanceTemplateCreatePayload
): Promise<GovernanceTemplateDto> {
  const res = await apiFetch(url('/v1/templates'), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      code: payload.code,
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status ?? 'draft',
      default_workflow_policy_id: payload.default_workflow_policy_id ?? null,
      default_sla_policy_id: payload.default_sla_policy_id ?? null,
      default_naming_convention_id: payload.default_naming_convention_id ?? null,
      default_approval_policy_id: payload.default_approval_policy_id ?? null,
    }),
  })
  return handleJson<GovernanceTemplateDto>(res)
}

async function createPolicy(path: string, payload: PolicyCreatePayload): Promise<CatalogItemDto> {
  const res = await apiFetch(url(path), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      code: payload.code,
      name: payload.name,
      description: payload.description ?? null,
      rule_regex: payload.rule_regex ?? null,
    }),
  })
  return handleJson<CatalogItemDto>(res)
}

export function createWorkflowPolicy(payload: PolicyCreatePayload): Promise<CatalogItemDto> {
  return createPolicy('/v1/workflow-policies', payload)
}

export function createSlaPolicy(payload: PolicyCreatePayload): Promise<CatalogItemDto> {
  return createPolicy('/v1/sla-policies', payload)
}

export function createNamingConvention(payload: PolicyCreatePayload): Promise<CatalogItemDto> {
  return createPolicy('/v1/naming-conventions', payload)
}

export function createApprovalPolicy(payload: PolicyCreatePayload): Promise<CatalogItemDto> {
  return createPolicy('/v1/approval-policies', payload)
}

async function deleteCatalogItem(path: string): Promise<void> {
  const res = await apiFetch(url(path), {
    method: 'DELETE',
    headers: tectonaServiceHeaders(),
  })
  await handleJson<Record<string, unknown>>(res)
}

export function deleteGovernanceTemplate(templateId: string): Promise<void> {
  return deleteCatalogItem(`/v1/templates/${templateId}`)
}

export function deleteWorkflowPolicy(policyId: string): Promise<void> {
  return deleteCatalogItem(`/v1/workflow-policies/${policyId}`)
}

export function deleteSlaPolicy(policyId: string): Promise<void> {
  return deleteCatalogItem(`/v1/sla-policies/${policyId}`)
}

export function deleteNamingConvention(policyId: string): Promise<void> {
  return deleteCatalogItem(`/v1/naming-conventions/${policyId}`)
}

export function deleteApprovalPolicy(policyId: string): Promise<void> {
  return deleteCatalogItem(`/v1/approval-policies/${policyId}`)
}
