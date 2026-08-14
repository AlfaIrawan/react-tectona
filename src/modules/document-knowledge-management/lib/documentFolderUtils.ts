import type { DocumentFolder } from '@/lib/api/documentFolderApi'

export function nextUntitledDocumentFolderName(siblingFolders: DocumentFolder[]): string {
  const usedNumbers = siblingFolders
    .filter((folder) => /^Untitled \d+$/i.test(folder.name.trim()))
    .map((folder) => Number.parseInt(folder.name.trim().replace(/^Untitled /i, ''), 10))
    .filter((value) => Number.isFinite(value))
  const nextNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1
  return `Untitled ${nextNum}`
}
