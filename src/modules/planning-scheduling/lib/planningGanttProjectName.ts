export function normalizeGanttProjectName(project?: string): string {
  const trimmed = project?.trim()
  return trimmed || 'Unidentified'
}
