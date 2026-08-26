import { describe, expect, it } from 'vitest'
import { parseTemplateVersionNumber } from './templateDuplicateDetection'

describe('parseTemplateVersionNumber', () => {
  it('parses simple versions', () => {
    expect(parseTemplateVersionNumber('V1')).toBe(1)
    expect(parseTemplateVersionNumber('V2')).toBe(2)
  })

  it('parses single-decimal versions and orders them correctly', () => {
    // Segments are weighted (not raw decimal value) so ordering stays correct across any number
    // of segments — assert relative order, not the old bare-float semantics.
    expect(parseTemplateVersionNumber('V0.2')).toBeGreaterThan(parseTemplateVersionNumber('V0.1'))
    expect(parseTemplateVersionNumber('V1.0')).toBeGreaterThan(parseTemplateVersionNumber('V0.9'))
  })

  it('parses multi-segment versions without inverting ordering', () => {
    // Regression: the old regex only matched ONE decimal segment, so "V0.2.5" failed to parse at
    // all and fell back to 0 — making a genuinely NEWER revision (0.2.5) look OLDER than 0.2.
    const v02 = parseTemplateVersionNumber('V0.2')
    const v025 = parseTemplateVersionNumber('V0.2.5')
    const v03 = parseTemplateVersionNumber('V0.3')
    expect(v025).toBeGreaterThan(v02)
    expect(v03).toBeGreaterThan(v025)
  })

  it('returns 0 for unparseable input', () => {
    expect(parseTemplateVersionNumber(null)).toBe(0)
    expect(parseTemplateVersionNumber('')).toBe(0)
    expect(parseTemplateVersionNumber('not a version')).toBe(0)
  })
})
