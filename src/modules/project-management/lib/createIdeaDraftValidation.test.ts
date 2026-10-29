import { describe, expect, it } from 'vitest'
import { createIdeaDraftError } from './createIdeaDraftValidation'

describe('create idea draft validation', () => {
  const prompts = ['Describe the project', 'Explain its objective']
  const base = { mode: 'ai' as const, description: prompts.join('\n'), prompts }
  it.each([undefined, 'queued', 'running', 'awaiting_input', 'failed', 'cancelled'])(
    'blocks AI mode before a completed draft (%s)', (jobStatus) => {
      expect(createIdeaDraftError({ ...base, description: 'Some text', jobStatus })).not.toBeNull()
    },
  )
  it('requires actual AI output and current description', () => {
    expect(createIdeaDraftError({ ...base, jobStatus: 'completed', draftText: '' })).not.toBeNull()
    expect(createIdeaDraftError({ ...base, jobStatus: 'completed', draftText: 'Draft' })).not.toBeNull()
    expect(createIdeaDraftError({ ...base, description: 'Generated description', jobStatus: 'completed', draftText: 'Draft' })).toBeNull()
  })
  it('rejects empty manual input and guide text, regardless of whitespace', () => {
    for (const description of ['', '  ', prompts.join('\n\n'), prompts.join('  ')]) {
      expect(createIdeaDraftError({ ...base, mode: 'manual', description })).not.toBeNull()
    }
  })
  it('accepts manual answers and free text without requiring an AI job', () => {
    for (const description of ['Helpdesk for branch staff', `${prompts[0]}\nHelpdesk for branch staff\n${prompts[1]}`]) {
      expect(createIdeaDraftError({ ...base, mode: 'manual', description })).toBeNull()
    }
  })
  it('blocks save while processing even if an earlier draft exists', () => {
    expect(createIdeaDraftError({ ...base, mode: 'manual', description: 'Valid content', busy: true })).not.toBeNull()
  })
})
