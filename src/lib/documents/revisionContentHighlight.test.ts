import { describe, expect, it } from 'vitest'
import { buildRevisionContentDiff } from './revisionContentHighlight'

describe('buildRevisionContentDiff', () => {
  it('marks identical text as unchanged', () => {
    const result = buildRevisionContentDiff('Hello world', 'Hello world')
    expect(result.hasChanges).toBe(false)
    expect(result.segments).toEqual([{ type: 'equal', text: 'Hello world' }])
  })

  it('highlights added and removed words inside a line', () => {
    const result = buildRevisionContentDiff(
      'Policy covers remote access only.',
      'Policy covers remote and office access only.',
    )
    expect(result.hasChanges).toBe(true)
    const added = result.segments.filter((s) => s.type === 'added').map((s) => s.text).join('')
    expect(added).toMatch(/and|office/)
  })

  it('highlights inserted lines', () => {
    const previous = ['Line A', 'Line C'].join('\n')
    const current = ['Line A', 'Line B', 'Line C'].join('\n')
    const result = buildRevisionContentDiff(previous, current)
    expect(result.hasChanges).toBe(true)
    expect(result.segments.some((s) => s.type === 'added' && s.text.includes('Line B'))).toBe(true)
  })
})
