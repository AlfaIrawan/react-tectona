import { describe, expect, it } from 'vitest'
import { indonesianSubtitle, looksIndonesian } from './summaryTitleLocale'

describe('summary title subtitles', () => {
  it('detects an Indonesian summary and leaves an English one alone', () => {
    expect(looksIndonesian('Inisiatif ini mengusulkan Chat GenAI sebagai garda pertama untuk menangani isu nasabah cabang, mengurangi ketergantungan pada proses manual email ke Head Office.')).toBe(true)
    expect(looksIndonesian('This initiative proposes a GenAI chat as the first line for branch customer issues, reducing manual email escalation to the head office.')).toBe(false)
    expect(looksIndonesian('Pendek')).toBe(false)
  })

  it('knows the card titles, case-insensitively, and nothing else', () => {
    expect(indonesianSubtitle('Core Pressure')).toBe('Tekanan utama')
    expect(indonesianSubtitle('BUSINESS VALUE SCORE')).toBe('Skor nilai bisnis')
    expect(indonesianSubtitle('Postur eksekusi')).toBeNull()
  })
})

describe('readiness signal titles', () => {
  it('shows older Indonesian titles as the fixed English labels, with the Indonesian subtitle', async () => {
    const { englishReadinessTitle, indonesianSubtitle } = await import('./summaryTitleLocale')
    expect(englishReadinessTitle('Postur eksekusi')).toBe('Execution Posture')
    expect(englishReadinessTitle('Delivery Control')).toBe('Delivery Control')
    expect(indonesianSubtitle(englishReadinessTitle('Kesiapan stakeholder'))).toBe('Kesiapan stakeholder')
  })
})
