export type AssistantEvidenceItem = {
  source_service: string
  endpoint: string
  key_ref?: string | null
  details?: Record<string, unknown> | null
}

export type EvidenceSourceKind = 'internal' | 'document' | 'web'

export function evidenceLabel(item: AssistantEvidenceItem): string {
  const details = item.details ?? {}
  const title = typeof details.title === 'string' ? details.title.trim() : ''
  if (title) return title
  return item.key_ref ?? 'Internal source'
}

export function evidenceSourceKind(item: AssistantEvidenceItem): EvidenceSourceKind {
  const declaredKind = item.details?.source_kind
  if (declaredKind === 'document' || declaredKind === 'web' || declaredKind === 'internal') {
    return declaredKind
  }
  const sourceType =
    typeof item.details?.source_type === 'string' ? item.details.source_type.trim() : ''
  if (
    item.source_service === 'tectona-document-knowledge' ||
    sourceType === 'document_repository'
  ) {
    return 'document'
  }
  if (typeof item.details?.external_url === 'string') return 'web'
  return 'internal'
}

export function evidenceHref(item: AssistantEvidenceItem): string | null {
  const externalUrl =
    typeof item.details?.external_url === 'string' ? item.details.external_url.trim() : ''
  if (evidenceSourceKind(item) === 'web') {
    return /^https?:\/\//i.test(externalUrl) ? externalUrl : null
  }
  if (!item.key_ref) return null
  const keyRef = encodeURIComponent(item.key_ref)
  if (evidenceSourceKind(item) === 'document') {
    return `/document-knowledge-management?documentId=${keyRef}`
  }
  if (item.source_service === 'tectona-kb' || item.source_service === 'tectona-knowledge-index') {
    return `/document-knowledge-management?kbEntry=${keyRef}`
  }
  return null
}

export function filterCitedEvidence(evidence: AssistantEvidenceItem[]): AssistantEvidenceItem[] {
  const seen = new Set<string>()
  return evidence.filter((item) => {
    if (!item.key_ref || item.details?.cited_in_answer !== true) return false
    const key = `${item.source_service}:${item.key_ref}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
