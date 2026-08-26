import { describe, expect, it } from 'vitest'

import { getFileTypeIcon, getFileTypeLabel } from './fileTypeIcon'

describe('Word template file icons', () => {
  it.each(['template.doc', 'template.docx', 'template.dot', 'template.dotx'])('recognizes %s as Word', (fileName) => {
    expect(getFileTypeIcon(fileName)).toBe('/images/icons/icon-word.png')
    expect(getFileTypeLabel(fileName)).toBe('Word')
  })
})
