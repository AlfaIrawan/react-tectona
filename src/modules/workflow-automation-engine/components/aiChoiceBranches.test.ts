import { describe, expect, it } from 'vitest'
import {
  aiChoiceBranches,
  aiChoiceHandle,
  aiChoiceOptions,
  aiFieldsOf,
  aiOutputKey,
  aiOutputPaths,
  isAiChoiceMode,
  isAiFieldsMode,
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

describe('AI Process Fields', () => {
  it('reads the builder JSON and names the paths like the engine', () => {
    const node = {
      id: 'n-1',
      data: {
        label: 'Cek URD',
        config: {
          outputFormat: 'fields',
          fields: JSON.stringify([{ name: 'Lengkap', type: 'boolean', required: true }, { name: 'kekurangan', type: 'list' }, { name: '' }]),
        },
      },
    }
    expect(isAiFieldsMode(node.data.config)).toBe(true)
    expect(aiFieldsOf(node.data.config).map((field) => field.type)).toEqual(['boolean', 'list', 'text'])
    expect(aiOutputPaths(node).map((item) => item.path)).toEqual(['ai.cek_urd.data.lengkap', 'ai.cek_urd.data.kekurangan'])
    expect(aiFieldsOf({ fields: 'not json' })).toEqual([])
  })

  it('offers the right path for each output kind', () => {
    expect(aiOutputPaths({ id: 'x', data: { label: 'Ringkas revisi', config: {} } }).map((item) => item.path)).toEqual(['ai.ringkas_revisi.answer'])
    expect(aiOutputPaths({ id: 'x', data: { label: 'Review?', config: { outputFormat: 'choice', choices: 'Ya\nTidak' } } }).map((item) => item.path))
      .toEqual(['ai.review.choice', 'ai.review.answer'])
  })
})
