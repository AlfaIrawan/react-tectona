export const PROJECT_DOCUMENT_FOLDER_DESCRIPTION_PREFIX = 'tectona_project_id:'
export const PROJECT_DOCUMENT_FOLDER_NAME_PREFIX = 'Project '
/** Fixed accent color for project-linked Document Repository folders — distinct from user-chosen folder colors. */
export const PROJECT_DOCUMENT_FOLDER_ACCENT_COLOR = '#6366f1'

export function buildProjectDocumentFolderDescription(projectId: string): string {
  return `${PROJECT_DOCUMENT_FOLDER_DESCRIPTION_PREFIX}${projectId}`
}

export function parseProjectIdFromDocumentFolderDescription(
  description: string | null | undefined,
): string | null {
  if (!description?.startsWith(PROJECT_DOCUMENT_FOLDER_DESCRIPTION_PREFIX)) return null
  const projectId = description.slice(PROJECT_DOCUMENT_FOLDER_DESCRIPTION_PREFIX.length).trim()
  return projectId || null
}

/** Document Repository folder name for a project's synced folder, e.g. "Project Wakatobi". */
export function buildProjectDocumentFolderName(projectName: string): string {
  return `${PROJECT_DOCUMENT_FOLDER_NAME_PREFIX}${projectName}`
}

/** True when a Document Repository folder is the auto-synced folder for a project (locked name/color). */
export function isProjectLinkedDocumentFolder(description: string | null | undefined): boolean {
  return parseProjectIdFromDocumentFolderDescription(description) !== null
}
