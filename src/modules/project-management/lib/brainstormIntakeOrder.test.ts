import { describe, expect, it } from 'vitest'
import { brainstormIntakeOrder } from './brainstormIntakeOrder'

const answer = (id: string, turn?: number) => ({ id, question: id, answer: 'a', turn })
const followup = (question: string, turn?: number) => ({ question, answer: 'a', turn })
const labels = (entries: ReturnType<typeof brainstormIntakeOrder>) =>
  entries.map((e) => (e.kind === 'answer' ? e.item.id : e.kind === 'followup' ? `+${e.item.question}` : `?${e.question}`))

describe('brainstormIntakeOrder', () => {
  it('puts each follow-up after the question the brainstorm asked before it', () => {
    expect(labels(brainstormIntakeOrder(
      [answer('project', 1), answer('goal', 8), answer('users', 11)],
      [followup('source', 2), followup('measure', 6), followup('access', 12)],
      ['ssd role'],
      [14],
    ))).toEqual(['project', '+source', '+measure', 'goal', 'users', '+access', '?ssd role'])
  })

  it('keeps an answer without a turn after the one before it', () => {
    expect(labels(brainstormIntakeOrder(
      [answer('a', 1), answer('b'), answer('c', 9)],
      [followup('x', 3)],
    ))).toEqual(['a', 'b', '+x', 'c'])
  })

  it('shows answers, then follow-ups, then skipped ones when there are no turns', () => {
    expect(labels(brainstormIntakeOrder([answer('a'), answer('b')], [followup('x')], ['y']))).toEqual(['a', 'b', '+x', '?y'])
  })
})
