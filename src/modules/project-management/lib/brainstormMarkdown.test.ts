import { describe, expect, it } from 'vitest'
import { normalizeBrainstormMarkdown, splitBrainstormQuestion } from './brainstormMarkdown'
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
