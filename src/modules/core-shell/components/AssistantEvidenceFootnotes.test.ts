import { describe, expect, it } from 'vitest'

import {
  evidenceHref,
  evidenceSourceKind,
  filterCitedEvidence,
  type AssistantEvidenceItem,
} from './assistantEvidence'

const kbEvidence: AssistantEvidenceItem = {
  source_service: 'tectona-kb',
  endpoint: '/search',
  key_ref: 'kb-1',
  details: {
    title: 'Adira Finance Company Overview',
    cited_in_answer: true,
    source_kind: 'internal',
  },
}

describe('AssistantEvidenceFootnotes helpers', () => {
  it('keeps only explicitly cited evidence and removes duplicates', () => {
    const unrelated = {
      ...kbEvidence,
      key_ref: 'kb-2',
      details: { title: 'Unrelated retrieval result' },
    }

    expect(filterCitedEvidence([kbEvidence, kbEvidence, unrelated])).toEqual([kbEvidence])
  })

  it('builds internal KB and document links', () => {
    const documentEvidence: AssistantEvidenceItem = {
      source_service: 'tectona-document-knowledge',
      endpoint: '/documents',
      key_ref: 'doc-1',
      details: { cited_in_answer: true, source_kind: 'document' },
    }

    expect(evidenceHref(kbEvidence)).toBe('/document-knowledge-management?kbEntry=kb-1')
    expect(evidenceHref(documentEvidence)).toBe('/document-knowledge-management?documentId=doc-1')
  })

  it('allows only http web evidence links', () => {
    const webEvidence: AssistantEvidenceItem = {
      source_service: 'web-search',
      endpoint: '/search',
      key_ref: 'web-1',
      details: {
        cited_in_answer: true,
        source_kind: 'web',
        external_url: 'https://example.com/source',
      },
    }

    expect(evidenceSourceKind(webEvidence)).toBe('web')
    expect(evidenceHref(webEvidence)).toBe('https://example.com/source')
    expect(evidenceHref({ ...webEvidence, details: { ...webEvidence.details, external_url: 'javascript:alert(1)' } })).toBeNull()
  })
})
