export const FOLDER_NOTE_TITLE_MAX = 60
export const FOLDER_NOTE_BODY_MAX = 1000

export function formatFolderNoteTimestamp(iso: string): string {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function buildFolderNotesTooltip(titles: string[]): string {
  return titles.filter(Boolean).slice(0, 5).join('\n')
}
