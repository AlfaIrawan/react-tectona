/**
 * Per-user UI layout preferences (identity-lite).
 *
 * Preferences are a convenience, never a gate: every call here is allowed to fail
 * quietly, because a layout that falls back to defaults is a small annoyance while
 * a blocked page is not. Callers get `null` on failure rather than a thrown error.
 */

import { IDENTITY_API_BASE } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

/** One scope per surface, so two pages never overwrite each other's document. */
export type UiPreferenceScope = string

export type UiPreferenceDocument = Record<UiPreferenceScope, Record<string, unknown>>

export interface UiPreferencesResponse {
  user_id: string
  preferences: UiPreferenceDocument
  version: number
  updated_date?: string | null
}

function endpoint(identityRef: string): string {
  return `${IDENTITY_API_BASE}/v1/users/${encodeURIComponent(identityRef)}/ui-preferences`
}

export async function fetchUiPreferences(identityRef: string): Promise<UiPreferencesResponse | null> {
  try {
    const res = await apiFetch(endpoint(identityRef), {
      headers: tectonaServiceHeaders({ Accept: 'application/json' }),
    })
    if (!res.ok) return null
    return (await res.json()) as UiPreferencesResponse
  } catch {
    return null
  }
}

/**
 * Shallow-merges the given scopes server-side. Scopes absent from `patch` keep
 * whatever another device last wrote, so a stale tab cannot erase newer settings.
 */
export async function patchUiPreferences(
  identityRef: string,
  patch: UiPreferenceDocument,
): Promise<UiPreferencesResponse | null> {
  try {
    const res = await apiFetch(endpoint(identityRef), {
      method: 'PATCH',
      headers: tectonaServiceHeaders({ Accept: 'application/json' }),
      body: JSON.stringify({ preferences: patch }),
    })
    if (!res.ok) return null
    return (await res.json()) as UiPreferencesResponse
  } catch {
    return null
  }
}
