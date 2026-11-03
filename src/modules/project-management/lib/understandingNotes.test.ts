import { describe, expect, it } from 'vitest'
import { classifyUnderstandingNotes, countUnderstandingNotes, parseUnderstandingNotes, understandingStartsCollapsed, understandingNoteKind } from './understandingNotes'

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
      'WhatsApp: saluran komunikasi utama bagi Collector Field.',
      'Ad1ForFlow: sumber data kebijakan yang ada saat ini.',
    ])
    expect(notes[0].children.map(note => note.text)).toEqual([
      'Tujuan utama proyek ini adalah menyediakan bantuan bagi collector field.',
      'Project ingin membuat Chat Gen AI agar collector field dapat bertanya langsung.',
    ])
    expect(notes[2].children).toEqual([])
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

  it('does not call the screenshot problem and business users systems because they contain colons', () => {
    const source = [
      '- Tujuan utama: memberi jawaban kebijakan cepat, hilangkan WhatsApp & baca memo manual',
      '- Masalah utama: pertanyaan lewat WhatsApp tidak compliant, harus baca memo manual',
      '- Pengguna bisnis terdampak: Collector Field; Tim HO Collection.',
    ].join('\n')
    const notes = classifyUnderstandingNotes(parseUnderstandingNotes(source), true)
    expect(notes.map(note => note.text)).toEqual(source.split('\n').map(line => line.slice(2)))
    expect(notes.every(note => note.children.length === 0)).toBe(true)
    expect(understandingNoteKind(notes[1].text)).toBe('today')
    expect(understandingNoteKind(notes[2].text)).toBe('people')
  })

  it('does not invent an application classification for an arbitrary labeled phrase', () => {
    for (const label of ['Betul sekali: AI menjawab', 'Gen AI: hanya menjawab pertanyaan', 'Aturan kebijakan: dasar jawaban']) {
      expect(understandingNoteKind(label)).toBeNull()
    }
  })

  it('keeps separate topics out of a source-introduced system list', () => {
    const notes = parseUnderstandingNotes('- Sistem dan saluran yang tercatat:\n- WhatsApp: komunikasi\n- Masalah utama: baca memo manual\n- Pengguna bisnis terdampak: Collector Field')
    expect(notes[0].children.map(note => note.text)).toEqual(['WhatsApp: komunikasi'])
    expect(notes[1].text).toBe('Masalah utama: baca memo manual')
    expect(notes[2].text).toBe('Pengguna bisnis terdampak: Collector Field')
  })

  it('recognizes explicit topic labels even when the model made them bold', () => {
    expect(understandingNoteKind('**Masalah utama:** project ini masih manual')).toBe('today')
    expect(understandingNoteKind('**Pengguna bisnis terdampak:** Collector Field')).toBe('people')
    expect(understandingNoteKind('**Sistem yang digunakan:** WhatsApp')).toBe('systems')
  })
})
