import { apiFetch, tectonaServiceHeaders } from './httpClient'
import { tectonaAgentRuntimeApiBase } from './gatewayBase'
import type { LlmUsagePayload } from '@/lib/tokenTelemetry'

export type AbbreviationEvidence = { kind: string; id: string; workspace_id: string; title: string; quote: string }
export type AbbreviationCandidate = {
  abbr: string
  expansion: string
  domain: string
  not_confused_with: string
  status: 'supported' | 'needs_review' | 'conflict'
  evidence: AbbreviationEvidence[]
}
export type AbbreviationScan = {
  scan_id: string
  workspace_id: string
  scope: 'workspace' | 'accessible'
  use_ai?: boolean
  status: 'running' | 'paused' | 'completed'
  phase: 'discovering' | 'scanning'
  label: string
  percent: number | null
  processed: number
  total: number
  skipped: Array<{ title: string; reason: string }>
  warnings: string[]
  candidates: AbbreviationCandidate[]
  review?: AbbreviationReviewItem[]
  created_at: string
  updated_at: string
  usage: LlmUsagePayload
}
export type AbbreviationReviewItem = { candidate_key: string; abbr: string; expansion: string; domain: string; not_confused_with: string; selected: boolean }

async function requestScan(path: string, init: RequestInit = {}): Promise<AbbreviationScan> {
  const res = await apiFetch(`${tectonaAgentRuntimeApiBase()}/v1/agent/abbreviation-scans${path}`, {
    ...init, headers: tectonaServiceHeaders(),
  }, path.endsWith('/advance') ? 150_000 : 30_000)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body?.detail ?? body?.error?.message
    throw new Error(typeof detail === 'string' ? detail : `Scan request failed (${res.status})`)
  }
  return res.json()
}

export function createAbbreviationScan(payload: {
  workspace_id: string
  scope: 'workspace' | 'accessible'
  existing_rows: Array<Record<string, string>>
  exclude_entry_id?: string | null
  use_ai: boolean
}) {
  return requestScan('', { method: 'POST', body: JSON.stringify(payload) })
}
export function fetchAbbreviationScan(id: string) { return requestScan(`/${encodeURIComponent(id)}`) }
export function advanceAbbreviationScan(id: string) { return requestScan(`/${encodeURIComponent(id)}/advance`, { method: 'POST' }) }
export function pauseAbbreviationScan(id: string) { return requestScan(`/${encodeURIComponent(id)}/pause`, { method: 'POST' }) }
export function saveAbbreviationReview(id: string, items: AbbreviationReviewItem[]) {
  return requestScan(`/${encodeURIComponent(id)}/review`, { method: 'PUT', body: JSON.stringify({ items }) })
}
export async function findLatestAbbreviationScan(workspaceId: string, entryId?: string | null): Promise<AbbreviationScan | null> {
  const query = new URLSearchParams({ workspace_id: workspaceId })
  if (entryId) query.set('entry_id', entryId)
  const res = await apiFetch(`${tectonaAgentRuntimeApiBase()}/v1/agent/abbreviation-scans?${query}`, { headers: tectonaServiceHeaders() })
  if (!res.ok) throw new Error(`Scan history unavailable (${res.status})`)
  const data = await res.json() as { scans: AbbreviationScan[] }
  return data.scans[0] || null
}
