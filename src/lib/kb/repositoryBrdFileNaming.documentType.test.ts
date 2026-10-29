import { describe, expect, it } from 'vitest'
import {
  detectDocumentTypeFromFileName,
  explicitDocumentPrefix,
  prefixForTemplateDocumentKind,
  resolveStructuredDocumentPrefix,
} from './repositoryBrdFileNaming'

describe('detectDocumentTypeFromFileName', () => {
  it('reads the type from an underscore-structured name (regression: URD_ was renamed to FSD)', () => {
    expect(detectDocumentTypeFromFileName('URD_AdiraFinanceWs_Requirement_V2_20260806.docx')).toBe('urd')
    expect(detectDocumentTypeFromFileName('FSD_AdiraFinanceWs_FsdAdiraFinanceWsFunctional_V5_20260916.docx')).toBe('fsd')
    expect(detectDocumentTypeFromFileName('BRD_AdiraFinanceWs_BusinessRequirementDocumentationBRD_V4_20260806.docx')).toBe('brd')
  })

  it('lets the leading prefix win over a later type mention', () => {
    expect(detectDocumentTypeFromFileName('URD_Mapping_to_FSD.docx')).toBe('urd')
  })

  it('still recognises spelled-out and spaced names', () => {
    expect(detectDocumentTypeFromFileName('Functional Specification Loan.docx')).toBe('fsd')
    expect(detectDocumentTypeFromFileName('Template URD v1.docx')).toBe('urd')
    expect(detectDocumentTypeFromFileName('Sample Template.docx')).toBeNull()
    expect(resolveStructuredDocumentPrefix('URD_AdiraFinanceWs_Requirement_V2.docx')).toBe('URD')
  })
})

describe('explicitDocumentPrefix', () => {
  it('keeps any type the name states, with no fixed list', () => {
    expect(explicitDocumentPrefix('SRD_AdiraFinanceWs_Srd_V1_20261026')).toBe('SRD')
    expect(explicitDocumentPrefix('Template - SRD (Simplified Requirement Document).docx')).toBe('SRD')
    expect(explicitDocumentPrefix('TPL_AdiraFinanceWs_Requirement_V1_20261026.docx')).toBeNull()
    expect(explicitDocumentPrefix('Sample Template.docx')).toBeNull()
  })

  it('wins over a kind guessed from the content (the SRD upload was named BRD_)', () => {
    const fileName = 'Template - SRD (Simplified Requirement Document).docx'
    expect(prefixForTemplateDocumentKind('brd', fileName)).toBe('SRD')
    expect(resolveStructuredDocumentPrefix(fileName)).toBe('SRD')
    expect(prefixForTemplateDocumentKind('urd', 'Sample Template.docx')).toBe('URD')
  })
})
