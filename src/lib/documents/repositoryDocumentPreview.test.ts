import { describe, expect, it } from 'vitest'
import {
  isRepositoryNativePdfPreview,
  resolveRepositoryPreviewKind,
} from './repositoryDocumentPreview'

describe('repositoryDocumentPreview', () => {
  it('detects docx previews', () => {
    expect(resolveRepositoryPreviewKind('sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx')
  })

  it('detects pdf previews for native iframe rendering', () => {
    expect(resolveRepositoryPreviewKind('sample.pdf', 'application/pdf')).toBe('docviewer')
    expect(isRepositoryNativePdfPreview('Lampiran 1 - Isu Internal.pdf', 'application/pdf')).toBe(true)
  })
})
