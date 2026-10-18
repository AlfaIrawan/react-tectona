import { describe, expect, it } from 'vitest'
import {
  aiChoiceBranches,
  aiChoiceHandle,
  aiChoiceOptions,
  aiOutputKey,
  isAiChoiceMode,
} from './workflowNodeKinds'

// The same names as workflow-automation engine/context_values.py (tests/test_ai_process_step.py).
describe('AI Process Pick a branch', () => {
  it('names handles like the engine', () => {
    expect(aiChoiceHandle('Perlu review')).toBe('choice-perlu_review')
    expect(aiOutputKey('Ringkas revisi!', 'x', 'id')).toBe('ringkas_revisi')
    expect(aiOutputKey('', '', 'n-1')).toBe('n_1')
  })

  it('keeps each option once and adds Not sure last', () => {
    const config = { outputFormat: 'choice', choices: 'Perlu review\nTidak perlu\nperlu  REVIEW\n' }
    expect(isAiChoiceMode(config)).toBe(true)
    expect(aiChoiceOptions(config)).toEqual(['Perlu review', 'Tidak perlu'])
    expect(aiChoiceBranches(config)).toEqual([
      { id: 'choice-perlu_review', label: 'Perlu review' },
      { id: 'choice-tidak_perlu', label: 'Tidak perlu' },
      { id: 'uncertain', label: 'Not sure' },
    ])
  })

  it('is a text answer unless the format says otherwise', () => {
    expect(isAiChoiceMode({ choices: 'a\nb' })).toBe(false)
  })
})
