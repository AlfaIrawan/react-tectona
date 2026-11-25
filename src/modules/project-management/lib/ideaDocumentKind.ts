import type { DocumentResponse } from '@/lib/api/documentKnowledgeApi'
import type { RepositoryItem } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import { emailDocumentKindFromTemplateCode } from './urdReviewHeads'

type IdeaDocument = Pick<DocumentResponse, 'metadata' | 'document_type_code'>
const REQUIREMENT_KINDS = new Set(['URD', 'BRD', 'FSD', 'SRD'])

function metadataKind(doc: IdeaDocument | undefined): string | null {
  for (const raw of [doc?.metadata?.doc_type_label, doc?.metadata?.template_code]) {
    if (typeof raw !== 'string') continue
    const kind = emailDocumentKindFromTemplateCode(raw)
    if (kind) return kind
  }
  const kind = emailDocumentKindFromTemplateCode(doc?.document_type_code)
  return kind && REQUIREMENT_KINDS.has(kind) ? kind : null
}

export function ideaDocumentType(doc: IdeaDocument): string | null {
  const kind = metadataKind(doc)
  return kind && REQUIREMENT_KINDS.has(kind) ? kind : null
}

/** Metadata identifies generated documents even when the title is just the Idea's name. */
export function ideaDocumentMatchesApproval(
  doc: IdeaDocument | undefined,
  item: Pick<RepositoryItem, 'name' | 'displayName' | 'fileName'>,
  requestKinds: string[],
): boolean {
  const requested = requestKinds.map(emailDocumentKindFromTemplateCode).filter((kind): kind is string => Boolean(kind))
  const kind = metadataKind(doc)
  if (kind) return requested.includes(kind)
  // Legacy uploads may have no template metadata. Match whole tokens, never substrings.
  const tokens = `${item.name} ${item.displayName ?? ''} ${item.fileName}`.toUpperCase().split(/[^A-Z0-9]+/)
  return requested.some(candidate => tokens.includes(candidate))
}
