import { describe, expect, it } from 'vitest'
import { normalizeBrainstormMarkdown, parseNotedAnswer, splitBrainstormQuestion } from './brainstormMarkdown'
import { attachLatestSummaryDiagrams, confirmedSummaryDiagrams, latestSummaryDiagrams } from './brainstormLiveSummary'
import type { IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'

describe('brainstorm Markdown and question delivery', () => {
  it.each([
    ['**Apakah ada informasi tambahan?', 'Apakah ada informasi tambahan?'],
    ['**Tectona** belum dipakai. **Kapan aktif?', '**Tectona** belum dipakai. Kapan aktif?'],
    ['**Bold** dan `**literal`', '**Bold** dan `**literal`'],
    ['```plantuml\nA -> B: **literal\n```', '```plantuml\nA -> B: **literal\n```'],
    ['\\**literal', '\\**literal'],
    ['**Bold\nmultiline**', '**Bold\nmultiline**'],
    [
      'Oke, aku catat: **Berdasarkan konteks:\n- **Data leakage:** pertanyaan.\n- **Compliance: verifikasi.',
      'Oke, aku catat: Berdasarkan konteks:\n- **Data leakage:** pertanyaan.\n- Compliance: verifikasi.',
    ],
  ])('repairs only orphan emphasis: %s', (text, expected) => {
    expect(normalizeBrainstormMarkdown(text)).toBe(expected)
  })
  it('renders question text without relying on Markdown delimiters', () => {
    expect(splitBrainstormQuestion('Rangkuman diperbaiki.\n\n**Apakah sudah tepat?', 'Apakah sudah tepat?'))
      .toEqual({ rest: 'Rangkuman diperbaiki.', question: 'Apakah sudah tepat?' })
  })
  it('does not duplicate a question containing emphasized application names', () => {
    expect(splitBrainstormQuestion('Rangkuman.\n\nKapan **Tectona** akan aktif?', 'Kapan Tectona akan aktif?'))
      .toEqual({ rest: 'Rangkuman.', question: 'Kapan Tectona akan aktif?' })
  })
  it('does not interpret code as a question', () => {
    expect(splitBrainstormQuestion('```text\nquestion?\n```').question).toBe('')
  })
  it('splits a noted answer from the question it confirms', () => {
    expect(parseNotedAnswer(
      'Untuk pertanyaan "Jelaskan tujuan utama dari project ini", dari ceritamu aku catat: Membantu collector field memperoleh jawaban kebijakan secara cepat dan aman melalui Gen AI.',
    )).toEqual({
      question: 'Jelaskan tujuan utama dari project ini',
      answer: 'Membantu collector field memperoleh jawaban kebijakan secara cepat dan aman melalui Gen AI.',
    })
    expect(parseNotedAnswer('Oke, aku catat: metriknya 30 detik.')).toBeNull()
  })
  it('keeps an example in parentheses as part of the question', () => {
    const asked = 'Dari mana saja data kebijakan yang akan dijawab oleh Chat Gen AI? (misalnya dokumen kebijakan internal, database regulasi, atau sumber lain)'
    expect(splitBrainstormQuestion(`Rangkuman.\n\n${asked}`)).toEqual({ rest: 'Rangkuman.', question: asked })
  })
})

const messages: IdeaDraftBrainstormMessage[] = [
  { role: 'assistant', text: 'AS-IS — proses saat ini:\n\n```mermaid\nflowchart LR\nA-->B\n```' },
  { role: 'assistant', text: 'flow AS-IS sudah terkonfirmasi' },
  { role: 'assistant', text: 'TO-BE — proses baru:\n\n```mermaid\nflowchart LR\nA-->C\n```' },
  { role: 'assistant', text: 'flow TO-BE sudah terkonfirmasi' },
]
it('invalidates only affected diagrams and retains the historical timeline', () => {
  expect(confirmedSummaryDiagrams(messages).as_is).toBeTruthy()
  const revised: IdeaDraftBrainstormMessage[] = [...messages, { role: 'assistant', text: 'AS-IS direvisi.', invalidated_process_lanes: ['as_is'] }]
  expect(confirmedSummaryDiagrams(revised).as_is).toBeUndefined()
  expect(latestSummaryDiagrams(revised).as_is).toBeUndefined()
  expect(latestSummaryDiagrams(revised).to_be).toBeTruthy()
  expect(confirmedSummaryDiagrams(messages).as_is).toBeTruthy()
})
it('does not reuse an obsolete cached diagram after correction or summary refresh failure', () => {
  const revised: IdeaDraftBrainstormMessage[] = [...messages, { role: 'assistant', text: 'Revisi lintas fase.', invalidated_process_lanes: ['as_is', 'to_be'] }]
  const result = attachLatestSummaryDiagrams({ sections: [{ id: 'as_is_evidence', title: 'AS-IS', text: 'Corrected facts.', diagram: latestSummaryDiagrams(messages).as_is }] }, revised)
  expect(result.sections[0].diagram).toBeUndefined()
})
it('shows a newly drawn diagram as awaiting confirmation, not automatically confirmed', () => {
  const revised: IdeaDraftBrainstormMessage[] = [...messages, { role: 'assistant', text: 'Perlu revisi.', invalidated_process_lanes: ['as_is'] },
    { role: 'assistant', text: 'AS-IS — revisi:\n\n```mermaid\nflowchart LR\nA-->D\n```' }]
  expect(latestSummaryDiagrams(revised).as_is?.status).toBe('awaiting_confirmation')
})


describe('structured question visibility independent of prose', () => {
  it('keeps code untouched when its literal text matches the question', () => {
    const text = '```text\nApakah sudah tepat?\n```'
    expect(splitBrainstormQuestion(text, 'Apakah sudah tepat?')).toEqual({ rest: text, question: 'Apakah sudah tepat?' })
  })
  it('removes only the emphasized prose question and preserves surrounding instructions', () => {
    expect(splitBrainstormQuestion('Konteks.\n\nApakah **Gen AI** sudah tepat?\n\nJelaskan alasannya.', 'Apakah Gen AI sudah tepat?'))
      .toEqual({ rest: 'Konteks.\n\n\n\nJelaskan alasannya.', question: 'Apakah Gen AI sudah tepat?' })
  })
  it('matches literal punctuation and wrapped question words without using them as regex', () => {
    expect(splitBrainstormQuestion('Pilih A+B (opsi 1)\natau C?\n\nSebutkan alasannya.', 'Pilih A+B (opsi 1) atau C?'))
      .toEqual({ rest: 'Sebutkan alasannya.', question: 'Pilih A+B (opsi 1) atau C?' })
  })
})

it('does not erase a quoted question from a recorded answer', () => {
  const text = 'Untuk pertanyaan "Siapa penggunanya?", dari ceritamu aku catat: petugas.'
  expect(splitBrainstormQuestion(text, 'Siapa penggunanya?')).toEqual({ rest: text, question: 'Siapa penggunanya?' })
})

it.each([
  'Sebutkan sistem produksi yang dibutuhkan.',
  'Sebutkan sistem produksi yang dibutuhkan?',
  'Sebutkan sistem produksi yang dibutuhkan.\n\nJangan mengarang fakta.',
])('preserves a distinct longer instruction: %s', text => {
  expect(splitBrainstormQuestion(text, 'Sebutkan sistem')).toEqual({ rest: text, question: 'Sebutkan sistem' })
})
