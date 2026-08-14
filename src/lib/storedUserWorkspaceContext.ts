import { TENANT_STORAGE_KEY } from './onboardingFeature'

export const TENANT_SUBJECT_STORAGE_KEY = 'tectona:active-tenant-subject-id'
export const LAST_ROUTE_STORAGE_KEY = 'tectona:last-route'

/** Clears workspace routing context that must not leak across user sessions. */
export function clearStoredUserWorkspaceContext(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(TENANT_STORAGE_KEY)
    sessionStorage.removeItem(TENANT_SUBJECT_STORAGE_KEY)
    sessionStorage.removeItem('tectona:accessible-workspace-ids')
    const lastRoute = localStorage.getItem(LAST_ROUTE_STORAGE_KEY)?.trim()
    if (lastRoute?.startsWith('/w/')) {
      localStorage.removeItem(LAST_ROUTE_STORAGE_KEY)
    }
  } catch {
    // ignore private mode / quota errors
  }
}

export function readStoredTenantSubjectId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(TENANT_SUBJECT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function persistStoredTenantSubjectId(subjectId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(TENANT_SUBJECT_STORAGE_KEY, subjectId)
  } catch {
    // ignore
  }
}
