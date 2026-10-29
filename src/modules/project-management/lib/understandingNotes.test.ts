import { describe, expect, it } from 'vitest'
import { classifyUnderstandingNotes, countUnderstandingNotes, parseUnderstandingNotes, understandingStartsCollapsed } from './understandingNotes'

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

  it('groups notes of the same kind and leaves a single note where it is', () => {
    const notes = classifyUnderstandingNotes(parseUnderstandingNotes([
      '- Tujuan utama proyek ini adalah menyediakan bantuan bagi collector field.',
      '- Project ingin membuat Chat Gen AI agar collector field dapat bertanya langsung.',
      '- Saat ini collector field harus menanyakan kebijakan lewat WhatsApp.',
      '- WhatsApp: saluran komunikasi utama bagi Collector Field.',
      '- Ad1ForFlow: sumber data kebijakan yang ada saat ini.',
    ].join('\n')), true)
    expect(notes.map(note => note.text)).toEqual([
      'Yang ingin dicapai:',
      'Saat ini collector field harus menanyakan kebijakan lewat WhatsApp.',
      'Sistem dan saluran yang tercatat:',
    ])
    expect(notes[0].children.map(note => note.text)).toEqual([
      'Tujuan utama proyek ini adalah menyediakan bantuan bagi collector field.',
      'Project ingin membuat Chat Gen AI agar collector field dapat bertanya langsung.',
    ])
    expect(notes[2].children.map(note => note.text)).toEqual([
      'WhatsApp: saluran komunikasi utama bagi Collector Field.',
      'Ad1ForFlow: sumber data kebijakan yang ada saat ini.',
    ])
  })

  it('does not wrap a list the summary already introduced', () => {
    const notes = classifyUnderstandingNotes(parseUnderstandingNotes([
      '- Sistem yang digunakan meliputi:',
      '- WhatsApp: saluran',
      '- Ad1ForFlow: sumber',
      '- Project membantu',
    ].join('\n')), true)
    expect(notes[0].text).toBe('Sistem yang digunakan meliputi:')
    expect(notes[0].children.map(note => note.text)).toEqual(['WhatsApp: saluran', 'Ad1ForFlow: sumber'])
  })

  it('starts collapsed only after the preview', () => {
    const three = parseUnderstandingNotes('- a\n- b\n- c')
    const four = parseUnderstandingNotes('- a\n- b\n- c\n- d')
    expect(understandingStartsCollapsed(three)).toBe(false)
    expect(understandingStartsCollapsed(four)).toBe(true)
  })
})
