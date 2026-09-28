import { describe, expect, it } from 'vitest'
import { boardNotePoints } from './boardNote'

describe('boardNotePoints', () => {
  it('turns an older one-paragraph note into a status and numbered points', () => {
    expect(boardNotePoints('WATCH: Lanjutkan ke tahap validasi. Fokus pada mitigasi risiko utama.')).toEqual({
      status: 'WATCH', lead: '', points: ['Lanjutkan ke tahap validasi.', 'Fokus pada mitigasi risiko utama.'],
    })
  })

  it('reads the normalized list the backend now writes', () => {
    expect(boardNotePoints('GO:\n1. Mulai pilot.\n2. Siapkan baseline MTTR.')).toEqual({
      status: 'GO', lead: '', points: ['Mulai pilot.', 'Siapkan baseline MTTR.'],
    })
  })

  it('works without a status and caps the list', () => {
    expect(boardNotePoints('A satu. B dua. C tiga. D empat. E lima.').points).toHaveLength(4)
    expect(boardNotePoints('Catatan tanpa status.').status).toBe('')
  })

  it('keeps an intro line above a written list instead of splitting it into points', () => {
    expect(boardNotePoints('WATCH: Lanjutkan ke tahap validasi dengan fokus pada:\n1. Klarifikasi asumsi teknis.\n2. Mitigasi risiko utama.')).toEqual({
      status: 'WATCH',
      lead: 'Lanjutkan ke tahap validasi dengan fokus pada:',
      points: ['Klarifikasi asumsi teknis.', 'Mitigasi risiko utama.'],
    })
  })
})
