/**
 * Tilia Agent Runtime API client.
 *
 * Default dev traffic goes through Gateway Runtime via Vite proxy.
 * Override via `VITE_TILIA_AGENT_RUNTIME_API_URL` when needed.
 * Platform Tectona reuses the same runtime contract; workspace defaults to `react-tectona`.
 */

import { getSession } from '@/auth/authService'
import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase(
  '/api/tilia-agent-runtime',
  import.meta.env.VITE_TILIA_AGENT_RUNTIME_API_URL,
)
const GREET_POST_TIMEOUT_MS = 7000

export interface TiliaAgentRuntimeChatRequest {
  message: string
  context?: {
    workspace_id?: string
    user_id?: string
    session_id?: string
  }
  options?: {
    mode?: 'deterministic_first' | 'llm_first'
    max_evidence?: number
    allow_llm?: boolean
  }
}

export interface TiliaAgentRuntimeEvidenceItem {
  source_service: string
  endpoint: string
  record_id?: string | null
  key_ref?: string | null
  details?: Record<string, unknown> | null
}

export interface TiliaAgentRuntimeChatResponse {
  answer: string
  confidence_score: number
  evidence: TiliaAgentRuntimeEvidenceItem[]
  warnings: string[]
  correlation_id: string
  session_id?: string | null
  session_title?: string | null
}

export interface TiliaAgentGreetRequest {
  session_id?: string | null
  workspace_id?: string | null
  user_id?: string | null
}

export interface TiliaAgentGreetResponse {
  greeting: string
  agent_id: string
  agent_name: string
  capabilities: string[]
  session_id: string
}

function parseErrorMessage(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'Unknown runtime error'

  const value = raw as {
    detail?: unknown
    error?: { message?: unknown }
    message?: unknown
  }

  if (typeof value.error?.message === 'string' && value.error.message.trim()) return value.error.message
  if (typeof value.message === 'string' && value.message.trim()) return value.message
  if (typeof value.detail === 'string' && value.detail.trim()) return value.detail

  return 'Unknown runtime error'
}

export async function sendTiliaAgentRuntimeMessage(
  payload: TiliaAgentRuntimeChatRequest
): Promise<TiliaAgentRuntimeChatResponse> {
  const session = getSession()

  const mergedPayload: TiliaAgentRuntimeChatRequest = {
    ...payload,
    context: {
      workspace_id: payload.context?.workspace_id ?? 'react-tectona',
      user_id: payload.context?.user_id ?? session?.user?.id,
      session_id: payload.context?.session_id,
    },
  }

  const res = await apiFetch(`${BASE_URL}/v1/agent/chat`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(mergedPayload),
  })

  if (!res.ok) {
    let errPayload: unknown = null
    try {
      errPayload = await res.json()
    } catch {
      // ignore and fallback to status text
    }
    const msg = parseErrorMessage(errPayload)
    throw new Error(msg || `Runtime request failed (HTTP ${res.status})`)
  }

  return res.json() as Promise<TiliaAgentRuntimeChatResponse>
}

export async function greetTiliaAgent(payload: TiliaAgentGreetRequest): Promise<TiliaAgentGreetResponse> {
  const session = getSession()

  const body: TiliaAgentGreetRequest = {
    session_id: payload.session_id ?? null,
    workspace_id: payload.workspace_id ?? 'react-tectona',
    user_id: payload.user_id ?? session?.user?.id ?? null,
  }

  const postController = new AbortController()
  const postTimeout = setTimeout(() => postController.abort(), GREET_POST_TIMEOUT_MS)

  try {
    const res = await apiFetch(`${BASE_URL}/v1/agent/greet`, {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify(body),
      signal: postController.signal,
    })

    if (res.ok) {
      return res.json() as Promise<TiliaAgentGreetResponse>
    }
  } catch {
    // fallback to deterministic GET greet when POST fails or times out
  } finally {
    clearTimeout(postTimeout)
  }

  const query = new URLSearchParams()
  if (body.session_id) query.set('session_id', body.session_id)
  if (body.workspace_id) query.set('workspace_id', body.workspace_id)
  if (body.user_id) query.set('user_id', body.user_id)

  const fallbackUrl = `${BASE_URL}/v1/agent/greet${query.toString() ? `?${query.toString()}` : ''}`
  const fallbackRes = await apiFetch(fallbackUrl, { method: 'GET' })

  if (!fallbackRes.ok) {
    let errPayload: unknown = null
    try {
      errPayload = await fallbackRes.json()
    } catch {
      // ignore
    }
    throw new Error(parseErrorMessage(errPayload) || `Greet request failed (HTTP ${fallbackRes.status})`)
  }

  return fallbackRes.json() as Promise<TiliaAgentGreetResponse>
}
