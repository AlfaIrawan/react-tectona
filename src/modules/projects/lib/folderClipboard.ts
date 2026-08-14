export interface FolderClipboardEntry {
  folderId: string
  folderName: string
  sourceParentId: string | null
}

let clipboardEntry: FolderClipboardEntry | null = null

export function setFolderClipboard(entry: FolderClipboardEntry) {
  clipboardEntry = { ...entry }
}

export function getFolderClipboard(): FolderClipboardEntry | null {
  return clipboardEntry ? { ...clipboardEntry } : null
}

export function hasFolderClipboard(): boolean {
  return clipboardEntry !== null
}

export function clearFolderClipboard() {
  clipboardEntry = null
}
