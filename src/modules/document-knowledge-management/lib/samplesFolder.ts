/** Tectona system Samples library in Document Repository. */

export const SAMPLES_ROOT_NAME = 'Samples'
export const SAMPLES_ROOT_KIND = 'samples_root'
export const SAMPLES_CATEGORY_KIND = 'samples_category'
/** Amber/gold — distinct from default sky folders and indigo project folders. */
export const SAMPLES_FOLDER_ACCENT_COLOR = '#d97706'

export type SamplesFolderLike = {
  id: string
  name: string
  parent_id?: string | null
  is_system?: boolean | null
  folder_kind?: string | null
}

export function isSamplesRootFolder(folder: SamplesFolderLike): boolean {
  if (folder.folder_kind === SAMPLES_ROOT_KIND) return true
  if (folder.parent_id) return false
  if (folder.is_system && folder.name.trim().toLowerCase() === 'samples') return true
  return folder.name.trim().toLowerCase() === 'samples'
}

/** Only the Samples root is locked. Category folders inside it stay user-editable. */
export function isSamplesSystemFolder(folder: SamplesFolderLike): boolean {
  return isSamplesRootFolder(folder)
}

/** Root or a folder directly under Samples — used for the amber library tint. */
export function isSamplesLibraryFolder(
  folder: SamplesFolderLike,
  folders: readonly SamplesFolderLike[],
): boolean {
  if (isSamplesRootFolder(folder)) return true
  const parent = folders.find((item) => item.id === folder.parent_id)
  return parent ? isSamplesRootFolder(parent) : false
}
