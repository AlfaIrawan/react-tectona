import { describe, expect, it } from 'vitest'
import { ideaDocumentMatchesApproval, ideaDocumentType } from './ideaDocumentKind'

const row = {
  name: 'Pembuatan Chat Gen AI untuk Collection',
  displayName: 'Pembuatan Chat Gen AI untuk Collection V6',
  fileName: 'Template - SRD (Simplified Requirement Document) V6.docx',
}
const srd = {
  document_type_code: 'delivery_artifact',
  metadata: { doc_type_label: 'SRD', template_code: 'srd-adirafinancews-srdsimplifiedrequirement-v1-2-mvp7xy4r' },
}

describe('Idea document approval matching', () => {
  it('recognizes the reported SRD V6 with an Idea-only title', () => {
    expect(ideaDocumentType(srd)).toBe('SRD')
    expect(ideaDocumentMatchesApproval(srd, row, ['SRD'])).toBe(true)
    expect(ideaDocumentMatchesApproval(srd, row, ['URD'])).toBe(false)
  })

  it.each(['URD', 'BRD', 'FSD', 'SRD'])('preserves %s metadata and template-code matching', (kind) => {
    const document = { document_type_code: 'delivery_artifact', metadata: { template_code: `${kind.toLowerCase()}-workspace-template` } }
    expect(ideaDocumentType(document)).toBe(kind)
    expect(ideaDocumentMatchesApproval(document, row, [kind])).toBe(true)
  })

  it('uses the explicit kind before a legacy template prefix or conflicting title', () => {
    const document = { document_type_code: 'delivery_artifact', metadata: { doc_type_label: 'SRD', template_code: 'brd-old-code' } }
    expect(ideaDocumentMatchesApproval(document, { ...row, name: 'URD example' }, ['URD', 'BRD'])).toBe(false)
    expect(ideaDocumentMatchesApproval(document, row, ['SRD'])).toBe(true)
  })

  it('supports custom workflow kinds without forcing them into a requirement-document type', () => {
    const document = { document_type_code: 'delivery_artifact', metadata: { doc_type_label: 'RFC' } }
    expect(ideaDocumentType(document)).toBeNull()
    expect(ideaDocumentMatchesApproval(document, row, ['rfc'])).toBe(true)
    expect(ideaDocumentMatchesApproval(document, row, ['SRD'])).toBe(false)
  })

  it('falls back to file name for legacy documents without metadata', () => {
    expect(ideaDocumentMatchesApproval(undefined, row, ['SRD'])).toBe(true)
    expect(ideaDocumentMatchesApproval({ document_type_code: 'word', metadata: {} }, row, ['SRD'])).toBe(true)
    expect(ideaDocumentMatchesApproval(undefined, { ...row, fileName: 'XSRD2.docx' }, ['SRD'])).toBe(false)
  })

  it('does not offer approval when the published workflow requests no document', () => {
    expect(ideaDocumentMatchesApproval(srd, row, [])).toBe(false)
  })

  it('tolerates malformed metadata and never uses regex metacharacters as patterns', () => {
    expect(ideaDocumentMatchesApproval({ document_type_code: 'delivery_artifact', metadata: { doc_type_label: {}, template_code: null } }, row, ['.*'])).toBe(false)
    expect(ideaDocumentMatchesApproval(undefined, row, ['SRD', 'SRD'])).toBe(true)
  })
})
