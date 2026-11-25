import type { IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'
import { parseNotedAnswer, scopedConfirmationAnswerMissing, splitBrainstormQuestion } from './brainstormMarkdown'

const fold = (value: string) => value.replace(/\s+/g, ' ').replace(/[.]+$/, '').trim().toLowerCase()

export function brainstormConfirmationAnswerMissing(text: string, decisionText?: string | null) {
  return scopedConfirmationAnswerMissing(text) || (!text.trim() && !decisionText?.trim())
}

/** Separate the recap from the decision without treating a completed turn as another confirmation. */
export function brainstormConfirmationContent(message: IdeaDraftBrainstormMessage, splitQuestion = false) {
  const confirmationKind = message.question_kind === 'confirm' && !message.suggestion_options?.length
  const { rest, question } = splitQuestion || confirmationKind
    ? splitBrainstormQuestion(message.text, message.question_text)
    : { rest: message.text, question: '' }
  const summary = message.summary?.trim() ?? ''
  const noted = rest.split(/\n{2,}/).map(parseNotedAnswer).find(Boolean)
  const summaryRepeatsNotedAnswer = Boolean(noted && fold(summary) && fold(summary) === fold(noted.answer))
  const at = !summaryRepeatsNotedAnswer && summary ? rest.indexOf(summary) : -1
  const before = at >= 0 ? rest.slice(0, at).trim() : ''
  const after = at >= 0 ? rest.slice(at + summary.length).trim() : rest
  const text = summary && !summaryRepeatsNotedAnswer ? after : rest
  const isConfirmation = confirmationKind
    && Boolean(question || message.decision_text?.trim() || message.confirmation_choices?.length
      || /(?:^|\n)(?:\*\*)?(?:Yang ingin aku konfirmasi|Please confirm):/i.test(text))
  // Stored correction previews keep the proposed answer in revision_text, not
  // in the recap or question. Bind it only to its own revision confirmation.
  const revisionInConfirmation = isConfirmation && !message.decision_text?.trim()
    && Boolean(message.revision_text?.trim())
    && /^(?:Apakah revisi ini sudah sesuai\?|Is this revision right\?)$/i.test(question.trim())
  const decisionText = revisionInConfirmation ? message.revision_text : message.decision_text
  const decisionLabel = revisionInConfirmation
    ? (/^Apakah/i.test(question) ? 'Revisi yang perlu dikonfirmasi' : 'Revision to confirm')
    : message.decision_label
  return { rest, question, before, after, text, summaryRepeatsNotedAnswer, isConfirmation, decisionText, decisionLabel, revisionInConfirmation }
}
