import { apiFetch, tectonaServiceHeaders } from '@/lib/api/httpClient'
import { serviceApiBase } from '@/lib/api/gatewayBase'

export type IdeaWorkspaceSelectionPolicy = {
  workflow_id: string
  allowed_workspace_ids: string[]
  default_workspace_id: string | null
  selection_required: boolean
  popup_title: string
}

export async function loadIdeaWorkspaceSelectionPolicy(workspaceId: string): Promise<IdeaWorkspaceSelectionPolicy | null> {
  const base = import.meta.env.VITE_WORKFLOW_AUTOMATION_API_URL?.trim()
    || (import.meta.env.DEV ? '/api/workflow-automation' : serviceApiBase('/api/workflow-automation'))
  const response = await apiFetch(`${base.replace(/\/$/, '')}/v1/idea-creation-policy?workspace_id=${encodeURIComponent(workspaceId)}`, { headers: tectonaServiceHeaders() })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Workspace selection could not be verified. Please try again.')
  }
  return (await response.json()).policy
}

export function selectableIdeaWorkspaces<T extends { workspaceId: string }>(options: T[], policy: IdeaWorkspaceSelectionPolicy): T[] {
  return options.filter((option) => policy.allowed_workspace_ids.includes(option.workspaceId))
}
