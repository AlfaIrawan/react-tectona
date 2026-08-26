export type TokenEventSource = 'user' | 'system'

export type TokenEventKind = 'issued' | 'used' | 'refreshed' | 'revoked' | 'expired'

export interface TokenTelemetryEvent {
  id: string
  source: TokenEventSource
  kind: TokenEventKind
  event: string
  trigger?: string
  context?: string
  category?: 'auth' | 'llm'
  model?: string
  provider?: string
  vendor?: string
  inputCostIdr?: number
  outputCostIdr?: number
  totalCostIdr?: number
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  occurredAt: string
  tokenPreview?: string
  expiresAt?: string
}

export type LlmUsagePayload = {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  model?: string
  provider?: string
}

const STORAGE_PREFIX = 'tectona_token_telemetry:'
const MAX_EVENTS = 80

function storageKey(subjectId: string): string {
  return `${STORAGE_PREFIX}${subjectId}`
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) return '••••••••'
  return `${token.slice(0, 6)}••••${token.slice(-4)}`
}

export function readTokenTelemetry(subjectId: string): TokenTelemetryEvent[] {
  if (typeof window === 'undefined' || !subjectId) return []
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(subjectId)) ?? '[]')
    return Array.isArray(parsed) ? (parsed as TokenTelemetryEvent[]) : []
  } catch {
    return []
  }
}

export function recordTokenEvent(
  subjectId: string,
  event: Omit<TokenTelemetryEvent, 'id' | 'occurredAt'> & { occurredAt?: string },
): TokenTelemetryEvent | null {
  if (typeof window === 'undefined' || !subjectId) return null
  const entry: TokenTelemetryEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  }
  const next = [entry, ...readTokenTelemetry(subjectId)].slice(0, MAX_EVENTS)
  localStorage.setItem(storageKey(subjectId), JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('tectona:token-telemetry-updated'))
  return entry
}

export function recordLlmUsageEvent(
  subjectId: string,
  payload: LlmUsagePayload,
  trigger: string,
  source: TokenEventSource = 'user',
): TokenTelemetryEvent | null {
  const inputTokens = payload.input_tokens ?? payload.prompt_tokens
  const outputTokens = payload.output_tokens ?? payload.completion_tokens
  const totalTokens = payload.total_tokens ?? (
    typeof inputTokens === 'number' && typeof outputTokens === 'number'
      ? inputTokens + outputTokens
      : undefined
  )
  if (typeof totalTokens !== 'number') return null
  return recordTokenEvent(subjectId, {
    category: 'llm',
    source,
    kind: 'used',
    event: 'AI/LLM completion',
    trigger,
    context: payload.provider ? `${payload.provider}${payload.model ? ` · ${payload.model}` : ''}` : payload.model,
    model: payload.model,
    inputTokens,
    outputTokens,
    totalTokens,
    tokenPreview: `${totalTokens.toLocaleString()} LLM tokens`,
  })
}

export function removeTokenTelemetry(subjectId: string): void {
  if (typeof window === 'undefined' || !subjectId) return
  localStorage.removeItem(storageKey(subjectId))
}
