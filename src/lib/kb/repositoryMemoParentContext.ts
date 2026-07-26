/**
 * Resolve memo induk metadata from sibling documents in the same repository folder.
 */

import { listAllDocuments } from '@/lib/api/documentKnowledgeApi'
import {
  extractRepositoryDocumentText,
  resolveRepositoryDocumentFileForKb,
} from '@/lib/kb/repositoryKbFromDocument'
import {
  extractMemoMetadataFromDocumentText,
  isMemoAttachmentUpload,
  looksLikeMemoUploadFileName,
  type MemoMetadataExtract,
} from './repositoryMemoFromDocument'

const MEMO_HEADER_RE = /\bMEMO\s+INTERNAL\b/i

function looksLikeMemoIndukDocumentTitle(title: string, fileName?: string | null): boolean {
  const blob = `${title} ${fileName ?? ''}`.toLowerCase()
  if (isMemoAttachmentUpload(fileName ?? title, '')) return false
  if (looksLikeMemoUploadFileName(title) && !/\blampiran\b/i.test(blob)) return true
  if (/\b(kebijakan|smki)\b/i.test(blob) && !/\blampiran\b/i.test(blob)) return true
  return false
}

export async function resolveParentMemoMetadataFromFolder(params: {
  documentId: string
  folderId: string | null
}): Promise<MemoMetadataExtract | null> {
  const { documentId, folderId } = params
  if (!folderId) return null

  let items: Array<{ id: string; title: string }> = []
  try {
    const response = await listAllDocuments({ folder_id: folderId, page_size: 100 })
    items = response.items.map((item) => ({ id: item.id, title: item.title }))
  } catch {
    return null
  }

  for (const item of items) {
    if (item.id === documentId) continue
    if (!looksLikeMemoIndukDocumentTitle(item.title)) continue

    const sourceFile = await resolveRepositoryDocumentFileForKb(item.id)
    if (!sourceFile) continue

    let text = ''
    try {
      const extracted = await extractRepositoryDocumentText(sourceFile)
      text = extracted.text
    } catch {
      continue
    }

    if (!MEMO_HEADER_RE.test(text.slice(0, 12_000))) continue

    const metadata = extractMemoMetadataFromDocumentText(text)
    if (metadata.fromUnit || metadata.toAudience || metadata.issuedDate) {
      return metadata
    }
  }

  return null
}
