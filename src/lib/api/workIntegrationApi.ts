/**
 * Work Integration Hub API (python-work-integration-hub-service-fastapi).
 * Dev: Vite proxies /api/work-integration → http://localhost:8433
 */

import { apiFetch, tectonaServiceHeaders } from './httpClient'

// Origin only — the `/api/work-integration` route prefix already lives in each path
// below. Dev: empty so calls are same-origin and Vite proxies to :8433.
export const WORK_INTEGRATION_API_BASE = (
  (import.meta.env.VITE_WORK_INTEGRATION_API_URL as string | undefined) ?? ''
).replace(/\/$/, '') || (import.meta.env.DEV ? '' : 'http://localhost:8433')

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function simulateMondayInbound(payload: Record<string, unknown>) {
  const response = await apiFetch(`${WORK_INTEGRATION_API_BASE}/api/work-integration/v1/webhooks/monday`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return parseJson<{ ok: boolean; work_item: unknown }>(response)
}

export async function simulateJiraInbound(payload: Record<string, unknown>) {
  const response = await apiFetch(`${WORK_INTEGRATION_API_BASE}/api/work-integration/v1/webhooks/jira`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return parseJson<{ ok: boolean; work_item: unknown }>(response)
}

export interface MondaySyncBoardResult {
  board_id: string
  board_name: string | null
  synced: number
}

export interface MondaySyncResult {
  boards?: MondaySyncBoardResult[]
  synced?: number
}

/** Pull all visible Monday boards into Tectona on demand (manual "Sync Monday"). */
export async function syncMondayAll(): Promise<MondaySyncResult> {
  const response = await apiFetch(`${WORK_INTEGRATION_API_BASE}/api/work-integration/v1/monday/pull`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ all: true }),
  })
  return parseJson<MondaySyncResult>(response)
}

export interface JiraSyncProjectResult {
  project_key: string
  synced: number
}

export interface JiraSyncResult {
  projects?: JiraSyncProjectResult[]
  synced?: number
  project_key?: string
}

/** Pull Jira project issues into Tectona on demand (manual "Sync Jira"). */
export async function syncJiraAll(): Promise<JiraSyncResult> {
  const response = await apiFetch(`${WORK_INTEGRATION_API_BASE}/api/work-integration/v1/jira/pull`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ all: true }),
  })
  return parseJson<JiraSyncResult>(response)
}
