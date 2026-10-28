import { describe, expect, it } from 'vitest'
import { countUnderstandingNotes, parseUnderstandingNotes, understandingStartsCollapsed } from './understandingNotes'

describe('understanding notes', () => {
  it('keeps each bullet as its own note and joins a wrapped line', () => {
    const notes = parseUnderstandingNotes([
      '- Project membantu collector field dengan Gen AI',
      '- Saat ini tanya lewat WhatsApp',
      'dan kadang baca memo',
      '- Sumbernya Ad1ForFlow',
    ].join('\n'))
    expect(notes.map(note => note.text)).toEqual([
      'Project membantu collector field dengan Gen AI',
      'Saat ini tanya lewat WhatsApp dan kadang baca memo',
      'Sumbernya Ad1ForFlow',
    ])
  })

  it('numbers a list introduced by a colon as 1.1 and 1.2', () => {
    const notes = parseUnderstandingNotes([
      '- Saat ini sistem/aplikasi yang digunakan meliputi:',
      '- WhatsApp: saluran komunikasi utama',
      '- Ad1ForFlow: sumber data kebijakan',
      '- Project membantu collector field',
    ].join('\n'))
    expect(notes).toEqual([
      {
        text: 'Saat ini sistem/aplikasi yang digunakan meliputi:',
        children: [
          { text: 'WhatsApp: saluran komunikasi utama', children: [] },
          { text: 'Ad1ForFlow: sumber data kebijakan', children: [] },
        ],
      },
      { text: 'Project membantu collector field', children: [] },
    ])
    expect(countUnderstandingNotes(notes)).toBe(4)
  })

  it('starts collapsed only after the preview', () => {
    const three = parseUnderstandingNotes('- a\n- b\n- c')
    const four = parseUnderstandingNotes('- a\n- b\n- c\n- d')
    expect(understandingStartsCollapsed(three)).toBe(false)
    expect(understandingStartsCollapsed(four)).toBe(true)
  })
})
