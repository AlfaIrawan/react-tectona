/**
 * Tectona Knowledge Index (python-tectona-knowledge-index-service-fastapi, :8417).
 * Same-origin prefix — Vite/nginx proxy `/api/tectona-knowledge-index` → 8417.
 */

import { apiFetch, parseApiErrorMessage, tectonaServiceHeaders } from './httpClient'

const BASE_URL = (
  (import.meta.env.VITE_TECTONA_KNOWLEDGE_INDEX_API_URL as string | undefined)?.trim()
  || '/api/tectona-knowledge-index'
).replace(/\/$/, '')

export const KNOWLEDGE_INDEX_EMBED_BATCH_SIZE = 96

export interface EmbedTextsResponse {
  embeddings: number[][]
  model: string
  dimension: number
  correlation_id?: string
}

async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(text, `HTTP ${res.status}`))
  }
  return JSON.parse(text) as T
}

/** Embed ad-hoc texts via the knowledge-index provider. Does not persist chunks. */
export async function embedKnowledgeIndexTexts(
  texts: string[],
  timeoutMs: number = 45_000,
): Promise<Map<string, number[]>> {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const text of texts) {
    if (!text.trim() || seen.has(text)) continue
    seen.add(text)
    unique.push(text)
  }
  const vectorsByText = new Map<string, number[]>()
  if (unique.length === 0) return vectorsByText

  for (let offset = 0; offset < unique.length; offset += KNOWLEDGE_INDEX_EMBED_BATCH_SIZE) {
    const batch = unique.slice(offset, offset + KNOWLEDGE_INDEX_EMBED_BATCH_SIZE)
    const res = await apiFetch(
      `${BASE_URL}/v1/embeddings`,
      {
        method: 'POST',
        headers: tectonaServiceHeaders({ Accept: 'application/json' }),
        body: JSON.stringify({ texts: batch }),
      },
      timeoutMs,
    )
    const payload = await handleJson<EmbedTextsResponse>(res)
    if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== batch.length) {
      throw new Error('Knowledge index returned a different number of embeddings than input texts.')
    }
    for (let i = 0; i < batch.length; i += 1) {
      vectorsByText.set(batch[i], payload.embeddings[i])
    }
  }
  return vectorsByText
}
