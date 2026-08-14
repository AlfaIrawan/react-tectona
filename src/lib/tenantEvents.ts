export const TECTONA_TENANT_CHANGED_EVENT = 'tectona:tenant-changed'

export function dispatchTenantChanged(): void {
  window.dispatchEvent(new CustomEvent(TECTONA_TENANT_CHANGED_EVENT))
}
