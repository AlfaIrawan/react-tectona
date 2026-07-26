import { describe, expect, it } from 'vitest'
import {
  buildRepositoryFileMetadataSections,
  extractOfficeFileMetadata,
  parseRepositoryFileProperties,
} from './extractOfficeFileMetadata'

describe('extractOfficeFileMetadata', () => {
  it('parses stored file_properties payload', () => {
    const parsed = parseRepositoryFileProperties({
      size_bytes: 81920,
      file_name: 'sample.docx',
      pages: 13,
      words: 1238,
      author: 'CRM',
      company: 'PT Adira Dinamika Multi Finance',
      custom: { 'Nomor Tiket': 'HD-001' },
      extracted_at: '2026-06-13T00:00:00.000Z',
      source: 'docx',
    })

    expect(parsed?.pages).toBe(13)
    expect(parsed?.author).toBe('CRM')
    expect(parsed?.custom['Nomor Tiket']).toBe('HD-001')

    const sections = buildRepositoryFileMetadataSections(parsed)
    expect(sections.properties.some((row) => row.label === 'Pages' && row.value === '13')).toBe(true)
    expect(sections.people.some((row) => row.label === 'Author' && row.value === 'CRM')).toBe(true)
    expect(sections.custom.some((row) => row.label === 'Nomor Tiket')).toBe(true)
  })

  it('returns basic file metadata for non-docx uploads', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const metadata = await extractOfficeFileMetadata(file)
    expect(metadata.file_name).toBe('notes.txt')
    expect(metadata.size_bytes).toBe(5)
    expect(metadata.source).toBe('file-only')
  })
})
