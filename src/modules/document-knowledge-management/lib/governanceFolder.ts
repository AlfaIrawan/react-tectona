/** Tectona system Governance library in Document Repository (organization workspace only). */

export const GOVERNANCE_ROOT_NAME = 'Governance'
export const GOVERNANCE_ROOT_KIND = 'governance_root'
/** Emerald/teal — clearly distinct from amber Samples, indigo Project, and sky user folders. */
export const GOVERNANCE_FOLDER_ACCENT_COLOR = '#0d9488'

export type GovernanceFolderLike = {
  id: string
  name: string
  parent_id?: string | null
  is_system?: boolean | null
  folder_kind?: string | null
}

export function isGovernanceRootFolder(folder: GovernanceFolderLike): boolean {
  if (folder.folder_kind === GOVERNANCE_ROOT_KIND) return true
  if (folder.parent_id) return false
  return Boolean(folder.is_system) && folder.name.trim().toLowerCase() === 'governance'
}

/** Only the Governance root is locked; folders the org creates inside it stay editable. */
export function isGovernanceSystemFolder(folder: GovernanceFolderLike): boolean {
  return isGovernanceRootFolder(folder)
}
