import { describe, expect, it } from 'vitest'
import { citationNumberOf, markChatCitations } from './chatCitations'

describe('markChatCitations', () => {
  it('numbers each distinct source once, in order of first use', () => {
    const { text, sources } = markChatCitations(
      'Dampak bisnis jelas. [ref: BRD_Helpdesk_V3]\nIntegrasi Ivanti. [ref: URD_V1] Tim AI. [ref: brd_helpdesk_v3]',
    )
    expect(text).toBe('Dampak bisnis jelas. [1](#tec-cite-1)\nIntegrasi Ivanti. [2](#tec-cite-2) Tim AI. [1](#tec-cite-1)')
    expect(sources).toEqual(['BRD_Helpdesk_V3', 'URD_V1'])
  })

  it('leaves text without refs (and other brackets) alone', () => {
    expect(markChatCitations('ROI [tidak ditemukan angka di dokumen]')).toEqual({
      text: 'ROI [tidak ditemukan angka di dokumen]', sources: [],
    })
  })

  it('reads index ids as a document and finds the number behind a sanitized href', () => {
    expect(markChatCitations('X [ref: source:tectona-document-repository#doc:abc#chunk:1]').sources).toEqual(['Document'])
    expect(citationNumberOf('#user-content-tec-cite-2')).toBe(2)
    expect(citationNumberOf('https://example.com')).toBeNull()
  })
})
