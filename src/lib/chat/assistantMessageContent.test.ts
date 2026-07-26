import { describe, expect, it } from 'vitest'
import { splitAssistantGreetingLead } from './assistantMessageContent'

describe('splitAssistantGreetingLead', () => {
  it('extracts only time salutation with name from opening greeting', () => {
    const content = [
      'Selamat malam, root! 🌙 😊',
      '',
      'Aku **Tectona Assistant** — kamu lagi di Workspace Management.',
      'Mau mulai dari mana?',
    ].join('\n')

    expect(splitAssistantGreetingLead(content)).toEqual({
      greeting: 'Selamat malam, root! 🌙 😊',
      body: 'Aku **Tectona Assistant** — kamu lagi di Workspace Management.\nMau mulai dari mana?',
    })
  })

  it('extracts only first-line salutation from casual multi-line reply', () => {
    const content = [
      'Selamat malam, root! 🌙 😊',
      '',
      'Senang dengar dari kamu — kalau di sini waktunya sudah selamat malam 🌙.',
      'Ada yang bisa aku bantu? 🙂',
    ].join('\n')

    expect(splitAssistantGreetingLead(content)).toEqual({
      greeting: 'Selamat malam, root! 🌙 😊',
      body: 'Senang dengar dari kamu — kalau di sini waktunya sudah selamat malam 🌙.\nAda yang bisa aku bantu? 🙂',
    })
  })

  it('splits inline LLM greeting when salutation shares first line with body', () => {
    const content =
      'Selamat malam, root 🫡. Aku Tectona Assistant, ada di sini untuk membantu kamu di Workspace Management.'

    expect(splitAssistantGreetingLead(content)).toEqual({
      greeting: 'Selamat malam, root 🫡.',
      body: 'Aku Tectona Assistant, ada di sini untuk membantu kamu di Workspace Management.',
    })
  })

  it('returns null for halo-only line without selamat head', () => {
    expect(
      splitAssistantGreetingLead(
        'Halo root! Senang dengar dari kamu — kalau di sini waktunya sudah selamat malam.',
      ),
    ).toBeNull()
  })

  it('returns null for non-greeting assistant replies', () => {
    expect(
      splitAssistantGreetingLead('Email Niko Kurniawan adalah `niko.kurniawan@adira.co.id`.'),
    ).toBeNull()
  })
})
