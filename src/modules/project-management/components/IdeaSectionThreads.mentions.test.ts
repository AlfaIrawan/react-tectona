import { describe, expect, it } from 'vitest'
import { encodeMentions, mentionIdsOf, plainText } from './IdeaSectionThreads'

describe('mention markup', () => {
  const people = [{ id: 'u1', name: 'Alfa' }, { id: 'u2', name: 'Alfa Irawan' }]

  it('encodes picked names, longest first, and reads the ids back', () => {
    const body = encodeMentions('@Alfa Irawan dan @Alfa, cek ya', people)
    expect(body).toBe('@[Alfa Irawan](u2) dan @[Alfa](u1), cek ya')
    expect(mentionIdsOf(body)).toEqual(['u2', 'u1'])
    expect(plainText(body)).toBe('@Alfa Irawan dan @Alfa, cek ya')
  })

  it('leaves an unpicked @word as plain text', () => {
    expect(encodeMentions('email ke @helpdesk', people)).toBe('email ke @helpdesk')
    expect(mentionIdsOf('email ke @helpdesk')).toEqual([])
  })
})
