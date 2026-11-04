import { describe, expect, it } from 'vitest'
import type { IdeaDraftBrainstormMessage as Message } from '@/lib/api/tectonaAgentRuntimeApi'
import { brainstormConfirmationAnswerMissing, brainstormConfirmationContent } from './brainstormConfirmationContent'

const summary = 'Collector Field menanyakan kebijakan kepada Tim HO Collection.'
const phase: Message = {
  role: 'assistant', question_kind: 'confirm',
  text: 'Apakah batasan fase ini sudah tepat?', question_text: 'Apakah batasan fase ini sudah tepat?',
  decision_label: 'Batasan fase', decision_text: 'Fase pertama menggunakan dokumen yang diunggah ke Tectona. Belum ada integrasi ke Ad1ForFlow.',
  confirmation_choices: ['Konfirmasi batasan fase', 'Koreksi batasan fase'], confirmation_actions: ['confirm', 'adjust'],
}

describe('phase confirmation content in stored and new messages', () => {
  it.each(['Apakah revisi ini sudah sesuai?', 'Is this revision right?'])('uses the stored revision answer for %s without changing the transcript', (question) => {
    const message: Message = Object.freeze({ role: 'assistant', question_kind: 'confirm', summary,
      text: `${summary}\n\n${question}`, question_text: question,
      revision_text: 'Gen AI terintegrasi di DigiLearn untuk pencarian kebijakan.',
      confirmation_choices: ['Penggantian ini sudah benar', 'Masih ada yang keliru'],
    })
    const before = JSON.stringify(message)
    const content = brainstormConfirmationContent(message)
    expect(content).toMatchObject({ isConfirmation: true, revisionInConfirmation: true, text: '', decisionText: message.revision_text })
    expect(brainstormConfirmationAnswerMissing(content.text, content.decisionText)).toBe(false)
    expect(JSON.stringify(message)).toBe(before)
  })

  it('does not use an unrelated revision to unlock an empty phase confirmation', () => {
    const content = brainstormConfirmationContent({ ...phase, decision_text: null, revision_text: 'Old goal revision.' })
    expect(content.revisionInConfirmation).toBe(false)
    expect(brainstormConfirmationAnswerMissing(content.text, content.decisionText)).toBe(true)
  })

  it('retains phase content when a message also carries a revision note', () => {
    const content = brainstormConfirmationContent({ ...phase, revision_text: 'Old goal revision.' })
    expect(content.decisionText).toBe(phase.decision_text)
    expect(content.revisionInConfirmation).toBe(false)
  })

  it('keeps a revision with no answer blocked rather than approving the old recap', () => {
    const question = 'Apakah revisi ini sudah sesuai?'
    const content = brainstormConfirmationContent({ role: 'assistant', question_kind: 'confirm', summary,
      text: `${summary}\n\n${question}`, question_text: question, revision_text: '  ',
    })
    expect(content.revisionInConfirmation).toBe(false)
    expect(brainstormConfirmationAnswerMissing(content.text, content.decisionText)).toBe(true)
  })

  it('keeps a phase decision as a real confirmation even though its text is only the question', () => {
    const before = JSON.stringify(phase)
    expect(brainstormConfirmationContent(phase)).toMatchObject({ isConfirmation: true, text: '', question: phase.question_text })
    expect(JSON.stringify(phase)).toBe(before)
  })

  it.each(['', '\n\nKlarifikasi sudah dicatat tanpa mengganti fakta AS-IS. Pertanyaan wajib sudah selesai. Pilih Extended Question Business, Extended Question Technical, atau Generate Draft.'])('does not create a confirmation for an old completed turn: %s', (closing) => {
    expect(brainstormConfirmationContent({ role: 'assistant', question_kind: 'confirm', summary, text: summary + closing }))
      .toMatchObject({ isConfirmation: false, after: closing.trim(), question: '' })
  })

  it('keeps the next mandatory question separate after a phase is accepted', () => {
    expect(brainstormConfirmationContent({ role: 'assistant', question_kind: 'mandatory', summary, text: summary + '\n\nApa sistem yang digunakan?' }, true))
      .toMatchObject({ isConfirmation: false, question: 'Apa sistem yang digunakan?', text: '' })
  })

  it('does not hide a genuinely incomplete confirmation with choices', () => {
    expect(brainstormConfirmationContent({ ...phase, text: summary, summary, question_text: null, decision_text: null }))
      .toMatchObject({ isConfirmation: true, text: '', question: '' })
  })

  it('retains ordinary scoped confirmations and their visible answer', () => {
    const text = '**Yang ingin aku konfirmasi: Tujuan**\n\nPemahamanku untuk poin ini: Pencarian kebijakan lebih cepat.\n\nApakah tujuan ini sudah tepat?'
    expect(brainstormConfirmationContent({ role: 'assistant', question_kind: 'confirm', text }))
      .toMatchObject({ isConfirmation: true, question: 'Apakah tujuan ini sudah tepat?', text: text.slice(0, text.lastIndexOf('\n\n')) })
  })
})
