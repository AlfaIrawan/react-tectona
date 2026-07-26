export interface DocumentParserExtractResponse {
  text: string
  language?: string | null
  pages?: number | null
  metadata?: Record<string, unknown>
}

import { serviceApiBase } from './gatewayBase'
import { apiFetch, authHeaders } from './httpClient'

function getParserBase(): string {
  const env = import.meta.env.VITE_DOCUMENT_PARSER_API_URL?.trim()
  if (env) return env.replace(/\/+$/, '')
  return `${serviceApiBase('/api/document-parser', import.meta.env.VITE_DOCUMENT_PARSER_API_URL)}/v1`
}

async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const parsed = JSON.parse(text) as { detail?: unknown; error?: { message?: string } }
      if (typeof parsed.detail === 'string') detail = parsed.detail
      else if (typeof parsed.error?.message === 'string') detail = parsed.error.message
    } catch {
      // keep raw text
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

export async function extractDocumentTextPreview(file: File, maxChars = 16000): Promise<DocumentParserExtractResponse> {
  const base = getParserBase()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('max_chars', String(maxChars))

  const res = await apiFetch(`${base}/extract-text`, {
    method: 'POST',
    headers: authHeaders({ Accept: 'application/json' }),
    body: formData,
  })

  return handleJson<DocumentParserExtractResponse>(res)
}
