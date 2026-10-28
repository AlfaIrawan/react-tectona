import { describe, expect, it } from 'vitest'
import { parseUnderstandingNotes, understandingStartsCollapsed } from './understandingNotes'

describe('understanding notes', () => {
  it('keeps each bullet as its own note and joins a wrapped line', () => {
    const notes = parseUnderstandingNotes([
      '- Project membantu collector field dengan Gen AI',
      '- Saat ini tanya lewat WhatsApp',
      'dan kadang baca memo',
      '- Sumbernya Ad1ForFlow',
    ].join('\n'))
    expect(notes).toEqual([
      'Project membantu collector field dengan Gen AI',
      'Saat ini tanya lewat WhatsApp dan kadang baca memo',
      'Sumbernya Ad1ForFlow',
    ])
  })

  it('starts collapsed only after the preview', () => {
    expect(understandingStartsCollapsed(['a', 'b', 'c'])).toBe(false)
    expect(understandingStartsCollapsed(['a', 'b', 'c', 'd'])).toBe(true)
  })
})
