import { apiFetch, tectonaServiceHeaders } from '@/lib/api/httpClient'
import { serviceApiBase } from '@/lib/api/gatewayBase'

export type IdeaWorkspaceSelectionPolicy = {
  workflow_id: string
  allowed_workspace_ids: string[]
  default_workspace_id: string | null
  selection_required: boolean
  popup_title: string
  popup_description?: string
  option_descriptions?: Record<string, string>
  orchestrated?: boolean
}

function workflowBase(): string {
  return (import.meta.env.VITE_WORKFLOW_AUTOMATION_API_URL?.trim()
    || (import.meta.env.DEV ? '/api/workflow-automation' : serviceApiBase('/api/workflow-automation'))).replace(/\/$/, '')
}

async function postIntake<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(`${workflowBase()}/v1/${path}`, { method: 'POST', headers: tectonaServiceHeaders(), body: JSON.stringify(body) })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : result?.error?.message || 'Could not save the intake session. Retry the same submission.')
  return result as T
}

export async function startIdeaIntake(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<string> {
  const result = await postIntake<{ run_id: string }>('idea-intakes', { source_workspace_id: sourceWorkspaceId, target_workspace_id: targetWorkspaceId, request_key: crypto.randomUUID() })
  return result.run_id
}

export async function createIdeaInIntake<T>(runId: string, payload: unknown, actorId: string): Promise<T> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const key = `idea-intake-pending:${actorId}:${fingerprint}`
  // A lost HTTP response can be retried after reload without creating a second idea.
  let savedRun = runId
  try { savedRun = localStorage.getItem(key) || runId; localStorage.setItem(key, savedRun) } catch { /* The live run id remains idempotent when storage is unavailable. */ }
  const idea = await postIntake<T>(`idea-intakes/${encodeURIComponent(savedRun)}/create-idea`, { payload })
  try { localStorage.removeItem(key) } catch { /* Submission already succeeded. */ }
  return idea
}

export async function loadIdeaWorkspaceSelectionPolicy(workspaceId: string): Promise<IdeaWorkspaceSelectionPolicy | null> {
  const response = await apiFetch(`${workflowBase()}/v1/idea-creation-policy?workspace_id=${encodeURIComponent(workspaceId)}`, { headers: tectonaServiceHeaders() })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Workspace selection could not be verified. Please try again.')
  }
  return (await response.json()).policy
}

export function selectableIdeaWorkspaces<T extends { workspaceId: string }>(options: T[], policy: IdeaWorkspaceSelectionPolicy): T[] {
  return options.filter((option) => policy.allowed_workspace_ids.includes(option.workspaceId))
}
