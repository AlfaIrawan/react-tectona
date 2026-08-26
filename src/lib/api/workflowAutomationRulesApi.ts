import { apiFetch, tectonaServiceHeaders } from './httpClient'
import { serviceApiBase } from './gatewayBase'

const BASE_URL = import.meta.env.DEV ? '/api/workflow-automation' : serviceApiBase('/api/workflow-automation')

export type AutomationRuleTrigger = 'Manual' | 'Schedule' | 'Event' | 'Webhook'
export type AutomationRuleDto = {
  id: string
  workspace_id?: string | null
  name: string
  owner_id?: string | null
  owner_name?: string | null
  owner_email?: string | null
  trigger: AutomationRuleTrigger
  trigger_event: string
  condition: Record<string, unknown>
  action: Record<string, unknown>
  workflow_id?: string | null
  enabled: boolean
  trigger_count: number
  last_triggered?: string | null
  created_date: string
  updated_date: string
}

export type AutomationRuleInput = Partial<Omit<AutomationRuleDto, 'id' | 'trigger_count' | 'last_triggered' | 'created_date' | 'updated_date'>> & {
  name: string
  trigger: AutomationRuleTrigger
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`)
  return res.json() as Promise<T>
}

const headers = () => tectonaServiceHeaders()

export async function listAutomationRules(workspaceId?: string): Promise<AutomationRuleDto[]> {
  const qs = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  return readJson(await apiFetch(`${BASE_URL}/v1/automation-rules${qs}`, { headers: headers() }))
}

export async function createAutomationRule(body: AutomationRuleInput): Promise<AutomationRuleDto> {
  return readJson(await apiFetch(`${BASE_URL}/v1/automation-rules`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }))
}

export async function updateAutomationRule(id: string, body: Partial<AutomationRuleInput>): Promise<AutomationRuleDto> {
  return readJson(await apiFetch(`${BASE_URL}/v1/automation-rules/${encodeURIComponent(id)}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }))
}

export async function deleteAutomationRuleApi(id: string): Promise<void> {
  const response = await apiFetch(`${BASE_URL}/v1/automation-rules/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() })
  if (!response.ok && response.status !== 404) throw new Error((await response.text().catch(() => '')) || `HTTP ${response.status}`)
}
