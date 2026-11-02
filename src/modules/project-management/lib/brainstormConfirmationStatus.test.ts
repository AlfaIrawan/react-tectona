import { describe, expect, it } from 'vitest'
import type { IdeaDraftBrainstormMessage as Message } from '@/lib/api/tectonaAgentRuntimeApi'
import { brainstormConfirmationStatus } from './brainstormConfirmationStatus'

const confirm: Message = {
  role: 'assistant', question_kind: 'confirm',
  text: '**Yang ingin aku konfirmasi: Tujuan proyek**\n\nPemahamanku untuk poin ini: Mempercepat pencarian kebijakan.',
  confirmation_choices: ['Rangkuman tujuan sudah tepat', 'Perbaiki tujuan'], confirmation_actions: ['confirm', 'adjust'],
}
const assistant: Message = { role: 'assistant', text: 'Sebutkan pengguna bisnis.' }
const user = (text: string): Message => ({ role: 'user', text })

describe('confirmation color is based on the matching reply, not message age', () => {
  it('keeps unanswered confirmations pending', () => expect(brainstormConfirmationStatus([confirm], 0)).toBe('pending'))
  it('does not confirm a still optimistic send', () => expect(brainstormConfirmationStatus([confirm, user('Rangkuman tujuan sudah tepat')], 0)).toBe('pending'))
  it('confirms the exact submitted confirm action after a server response', () => expect(brainstormConfirmationStatus([confirm, user('Rangkuman tujuan sudah tepat'), assistant], 0)).toBe('confirmed'))
  it.each(['Perbaiki tujuan', 'Perbaiki tujuan: lebih aman', 'Tidak setuju', 'Ya tetapi perlu diubah', 'lanjut', 'Tujuannya apa?'])('does not mark corrections or unrelated replies as confirmed: %s', (text) => {
    expect(brainstormConfirmationStatus([confirm, user(text), assistant], 0)).toBe('pending')
  })
  it('recognizes a short explicit historical confirmation', () => expect(brainstormConfirmationStatus([confirm, user('Ya, sudah sesuai'), assistant], 0)).toBe('confirmed'))
  it('does not borrow a later confirmation of another topic', () => {
    expect(brainstormConfirmationStatus([confirm, user('Perlu perubahan'), assistant, user('Ya'), assistant], 0)).toBe('pending')
  })
  it('uses server-recorded acceptance only for the same topic', () => {
    const reply = { ...user('Gunakan usulan tadi'), accepted_decision: { question: 'Tujuan proyek', value: 'Cepat', item_id: 'goal', origin: 'assistant' as const } }
    expect(brainstormConfirmationStatus([confirm, reply, assistant], 0)).toBe('confirmed')
    expect(brainstormConfirmationStatus([confirm, { ...reply, accepted_decision: { ...reply.accepted_decision, question: 'Pengguna bisnis' } }, assistant], 0)).toBe('pending')
  })
  it('does not confirm an answer that was never visible', () => {
    expect(brainstormConfirmationStatus([{ ...confirm, text: '**Yang ingin aku konfirmasi: Tujuan proyek**' }, user('Ya'), assistant], 0)).toBe('pending')
  })
})
