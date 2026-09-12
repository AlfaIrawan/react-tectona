/**
 * Microsoft Graph OneDrive listing via identity-lite (delegated Files.Read).
 */

import { IDENTITY_API_BASE } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

export type MicrosoftDriveItemKind = 'file' | 'folder'

export type MicrosoftDriveItem = {
  id: string
  name: string
  kind: MicrosoftDriveItemKind
  size: number
  mime_type?: string | null
  child_count?: number | null
  last_modified?: string | null
  web_url?: string | null
}

export type MicrosoftDriveListing = {
  connected: boolean
  drive: {
    id?: string | null
    name?: string | null
    drive_type?: string | null
    web_url?: string | null
    owner_email?: string | null
  }
  folder: {
    id: string
    name: string
    web_url?: string | null
    parent_id?: string | null
  }
  items: MicrosoftDriveItem[]
}

export type MicrosoftDriveStatus = {
  linked?: boolean
  connected: boolean
  consent_required?: boolean
  expires_at?: string | null
  scope?: string | null
}

export class MicrosoftGraphConsentRequiredError extends Error {
  constructor(message = 'Microsoft Graph consent is required.') {
    super(message)
    this.name = 'MicrosoftGraphConsentRequiredError'
  }
}

function parseIdentityErrorMessage(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; error_description?: string } | string
      detail?: { error_description?: string; message?: string } | string
    }
    const envelope = parsed.error
    if (typeof envelope === 'string' && envelope.trim()) return envelope
    if (envelope && typeof envelope === 'object') {
      const fromEnvelope = envelope.message || envelope.error_description
      if (fromEnvelope) return String(fromEnvelope)
    }
    if (typeof parsed.detail === 'string' && parsed.detail.trim()) return parsed.detail
    if (parsed.detail && typeof parsed.detail === 'object') {
      const fromDetail = parsed.detail.message || parsed.detail.error_description
      if (fromDetail) return String(fromDetail)
    }
  } catch {
    // keep fallback
  }
  if (status === 404) return 'OneDrive is not available for this account.'
  return raw.trim() || `HTTP ${status}`
}

async function handleJson<T>(res: Response): Promise<T> {
  const raw = await res.text().catch(() => '')
  if (res.status === 409) {
    throw new MicrosoftGraphConsentRequiredError(
      parseIdentityErrorMessage(raw, res.status) || 'Microsoft Graph consent is required.',
    )
  }
  if (!res.ok) {
    throw new Error(parseIdentityErrorMessage(raw, res.status))
  }
  return JSON.parse(raw) as T
}

/** True when this identity is linked to Microsoft (SSO), not a password-only account. */
export async function resolveMicrosoftAccountLinked(): Promise<boolean> {
  const { readAuthMethod } = await import('@/lib/authMethodSession')
  if (readAuthMethod() === 'microsoft') return true
  try {
    const status = await fetchMicrosoftDriveStatus()
    return status.linked === true || status.connected === true
  } catch {
    return false
  }
}

export async function fetchMicrosoftDriveStatus(): Promise<MicrosoftDriveStatus> {
  const res = await apiFetch(`${IDENTITY_API_BASE.replace(/\/$/, '')}/v1/me/microsoft/drive/status`, {
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
  })
  return handleJson<MicrosoftDriveStatus>(res)
}

export async function fetchMicrosoftDriveChildren(itemId?: string | null): Promise<MicrosoftDriveListing> {
  const base = IDENTITY_API_BASE.replace(/\/$/, '')
  const path = itemId
    ? `/v1/me/microsoft/drive/items/${encodeURIComponent(itemId)}/children`
    : '/v1/me/microsoft/drive'
  const res = await apiFetch(`${base}${path}`, {
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
  })
  return handleJson<MicrosoftDriveListing>(res)
}

/**
 * Downloads one OneDrive file so it can be re-uploaded through the repository's own
 * upload path. identity-lite proxies the bytes rather than exposing Graph's
 * pre-authenticated download URL to the page.
 */
export async function fetchMicrosoftDriveItemContent(itemId: string): Promise<Blob> {
  const base = IDENTITY_API_BASE.replace(/\/$/, '')
  const res = await apiFetch(`${base}/v1/me/microsoft/drive/items/${encodeURIComponent(itemId)}/content`, {
    headers: tectonaServiceHeaders({ Accept: '*/*' }),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // non-JSON error body; the status is enough
    }
    throw new Error(detail)
  }
  return res.blob()
}
