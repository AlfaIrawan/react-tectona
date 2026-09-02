import { describe, expect, it } from 'vitest'

import {
  EXPLORER_FOLDER_TYPE_LABEL,
  formatExplorerDateTime,
  getExplorerFileTypeLabel,
  getFileTypeIcon,
  getFileTypeLabel,
} from './fileTypeIcon'

describe('Word template file icons', () => {
  it.each(['template.doc', 'template.docx', 'template.dot', 'template.dotx'])('recognizes %s as Word', (fileName) => {
    expect(getFileTypeIcon(fileName)).toBe('/images/icons/icon-word.png')
    expect(getFileTypeLabel(fileName)).toBe('Word')
  })
})

describe('explorer file type labels', () => {
  it('uses Windows-style type names for grouping', () => {
    expect(getExplorerFileTypeLabel('report.xlsx')).toBe('Microsoft Excel Worksheet')
    expect(getExplorerFileTypeLabel('query.iqy')).toBe('Microsoft Excel Web Query File')
    expect(getExplorerFileTypeLabel('page.html')).toBe('HTML Document')
    expect(EXPLORER_FOLDER_TYPE_LABEL).toBe('File folder')
  })

  it('formats dates like Explorer details', () => {
    expect(formatExplorerDateTime('2026-08-22T08:54:00+07:00')).toMatch(/22\/08\/2026 \d{2}:\d{2}/)
  })
})
