const TENANT_SCOPED_STORAGE_KEYS = [
  'project-storage',
  'folder-storage',
  'project-document-folder-storage',
  'projects-display-order',
  'folder-notes-storage',
] as const

/** Clears browser-persisted project/folder state so a new workspace starts empty. */
export function clearTenantScopedClientData(): void {
  if (typeof window === 'undefined') return
  for (const key of TENANT_SCOPED_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore quota / private mode
    }
  }
}
