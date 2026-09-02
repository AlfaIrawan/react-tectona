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
  if (folder.is_system && !folder.parent_id && folder.name.trim().toLowerCase() === 'samples') return true
  return !folder.parent_id && folder.name.trim().toLowerCase() === 'samples'
}

export function isSamplesSystemFolder(
  folder: SamplesFolderLike,
  folders: readonly SamplesFolderLike[],
): boolean {
  if (folder.folder_kind === SAMPLES_ROOT_KIND || folder.folder_kind === SAMPLES_CATEGORY_KIND) return true
  if (folder.is_system) return true
  if (isSamplesRootFolder(folder)) return true
  const parent = folders.find((item) => item.id === folder.parent_id)
  return parent ? isSamplesRootFolder(parent) : false
}
