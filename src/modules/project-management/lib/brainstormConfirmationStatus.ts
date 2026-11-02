import type { IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'
import { scopedConfirmationAnswerMissing, splitScopedConfirmationContent } from './brainstormMarkdown'
import { brainstormConfirmationAnswerMissing, brainstormConfirmationContent } from './brainstormConfirmationContent'

export type BrainstormConfirmationStatus = 'pending' | 'confirmed'
const fold = (value: string) => value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Only an explicit response to this confirmation can make its historical panel green. */
export function brainstormConfirmationStatus(messages: IdeaDraftBrainstormMessage[], index: number): BrainstormConfirmationStatus {
  const message = messages[index]
  if (!message || message.role !== 'assistant' || message.question_kind !== 'confirm' || scopedConfirmationAnswerMissing(message.text)) return 'pending'
  const content = brainstormConfirmationContent(message)
  if (!content.isConfirmation || brainstormConfirmationAnswerMissing(content.text, message.decision_text)) return 'pending'
  const reply = messages[index + 1]
  // Do not color an optimistic send green before the server has replied.
  if (reply?.role !== 'user' || messages[index + 2]?.role !== 'assistant') return 'pending'
  const text = fold(reply.text)
  const choice = message.confirmation_choices?.findIndex(label => fold(label) === text) ?? -1
  if (choice >= 0) return (message.confirmation_actions?.[choice] ?? (choice === 0 ? 'confirm' : 'adjust')) === 'confirm' ? 'confirmed' : 'pending'
  const topic = splitScopedConfirmationContent(message.text)?.question
  if (topic && reply.accepted_decision && fold(reply.accepted_decision.question) === fold(topic)) return 'confirmed'
  // Conservative compatibility with short, explicit confirmations in older saved chats.
  return /^(?:ya|iya|yes|benar|betul|setuju|sudah tepat|sudah benar|ya,? sudah sesuai|yes,? this is correct|ya,? daftar sudah lengkap)[.!]?$/.test(text)
    ? 'confirmed' : 'pending'
}
