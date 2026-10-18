import type { IdeaIntakeAnswer, IdeaIntakeFollowup } from '@/lib/api/tectonaAgentRuntimeApi'

export type BrainstormIntakeEntry =
  | { kind: 'answer'; item: IdeaIntakeAnswer }
  | { kind: 'followup'; item: IdeaIntakeFollowup }
  | { kind: 'skipped'; question: string }

const KIND_ORDER = { answer: 0, followup: 1, skipped: 2 } as const

/**
 * The mandatory questions, the AI's follow-ups and the follow-ups skipped, in the order the
 * brainstorm asked them (each item's `turn`, its brainstorm message). An answer without a turn
 * stays after the one before it; a follow-up without one goes last, so an older response without
 * turns shows the answers first, then the follow-ups, as before.
 */
export function brainstormIntakeOrder(
  answers: IdeaIntakeAnswer[],
  followups: IdeaIntakeFollowup[],
  openPoints: string[] = [],
  openPointTurns: Array<number | null> = [],
): BrainstormIntakeEntry[] {
  const rows: Array<{ entry: BrainstormIntakeEntry; turn: number; index: number }> = []
  let lastAnswerTurn = -1
  answers.forEach((item, index) => {
    const turn = typeof item.turn === 'number' ? item.turn : lastAnswerTurn
    lastAnswerTurn = Math.max(lastAnswerTurn, turn)
    rows.push({ entry: { kind: 'answer', item }, turn, index })
  })
  followups.forEach((item, index) => {
    rows.push({ entry: { kind: 'followup', item }, turn: typeof item.turn === 'number' ? item.turn : Infinity, index })
  })
  openPoints.forEach((question, index) => {
    const turn = openPointTurns[index]
    rows.push({ entry: { kind: 'skipped', question }, turn: typeof turn === 'number' ? turn : Infinity, index })
  })
  return rows
    .sort((a, b) => a.turn - b.turn || KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] || a.index - b.index)
    .map((row) => row.entry)
}
