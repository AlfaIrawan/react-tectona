export interface IdeaFolderClipboardEntry {
  folderId: string
  folderName: string
  sourceParentId: string | null
}

let clipboardEntry: IdeaFolderClipboardEntry | null = null

export function setIdeaFolderClipboard(entry: IdeaFolderClipboardEntry) {
  clipboardEntry = { ...entry }
}

export function getIdeaFolderClipboard(): IdeaFolderClipboardEntry | null {
  return clipboardEntry ? { ...clipboardEntry } : null
}

export function hasIdeaFolderClipboard(): boolean {
  return clipboardEntry !== null
}

export function clearIdeaFolderClipboard() {
  clipboardEntry = null
}
