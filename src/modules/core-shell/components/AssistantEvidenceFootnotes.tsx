import { Link } from 'lucide-react'

export type AssistantEvidenceItem = {
  source_service: string
  endpoint: string
  key_ref?: string | null
  details?: Record<string, unknown> | null
}

type AssistantEvidenceFootnotesProps = {
  evidence: AssistantEvidenceItem[]
}

function evidenceLabel(item: AssistantEvidenceItem): string {
  const details = item.details ?? {}
  const title = typeof details.title === 'string' ? details.title.trim() : ''
  if (title) return title
  return item.key_ref ?? 'Knowledge Base entry'
}

function isDocumentRepositoryEvidence(item: AssistantEvidenceItem): boolean {
  const sourceType =
    typeof item.details?.source_type === 'string' ? item.details.source_type.trim() : ''
  return (
    item.source_service === 'tectona-document-knowledge' ||
    (item.source_service === 'tectona-knowledge-index' && sourceType === 'document_repository')
  )
}

function isKbEvidence(item: AssistantEvidenceItem): boolean {
  if (!item.key_ref) return false
  if (isDocumentRepositoryEvidence(item)) return false
  return (
    item.source_service === 'tectona-kb' ||
    item.source_service === 'tectona-knowledge-index'
  )
}

function evidenceHref(item: AssistantEvidenceItem): string {
  const keyRef = encodeURIComponent(item.key_ref ?? '')
  if (isDocumentRepositoryEvidence(item)) {
    return `/document-knowledge-management?documentId=${keyRef}`
  }
  return `/document-knowledge-management?kbEntry=${keyRef}`
}

// SOURCES footnotes are disabled in the chat sidebar per product decision (2026-06-24):
// the backend attaches every KB entry it retrieved per turn (not only the ones the answer
// actually cites), so the list was noisy/irrelevant (e.g. stakeholder profiles shown for a
// "buka direktori workspace" navigation reply). Flip this flag to `true` to restore it.
// Typed as `boolean` (not the literal `false`) so the body below stays reachable for linting.
const SHOW_CHAT_SOURCES: boolean = false

export function AssistantEvidenceFootnotes({ evidence }: AssistantEvidenceFootnotesProps) {
  if (!SHOW_CHAT_SOURCES) return null

  const citedEntries = evidence.filter((item) => isKbEvidence(item) || isDocumentRepositoryEvidence(item))
  if (citedEntries.length === 0) return null

  return (
    <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sources
      </p>
      <ul className="space-y-1">
        {citedEntries.map((item) => (
          <li key={`${item.source_service}:${item.key_ref}`} className="text-xs">
            <Link className="mr-1 inline h-3 w-3 align-text-bottom text-sky-600" aria-hidden />
            <a
              href={evidenceHref(item)}
              className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
            >
              {evidenceLabel(item)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
