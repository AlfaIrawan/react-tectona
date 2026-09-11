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

async function handleJson<T>(res: Response): Promise<T> {
  const raw = await res.text().catch(() => '')
  if (res.status === 409) {
    throw new MicrosoftGraphConsentRequiredError(raw || 'Microsoft Graph consent is required.')
  }
  if (!res.ok) {
    throw new Error(raw || `HTTP ${res.status}`)
  }
  return JSON.parse(raw) as T
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
