import { describe, expect, it } from 'vitest'
import { framingFieldKey, isEditableSummaryFieldKey, readinessAnchorKey, scoringFieldKey, summaryFieldLabel } from './summaryFields'

describe('summary field keys', () => {
  it('keys a Strategic Framing item by its title, like the backend', () => {
    expect(framingFieldKey('Sprint Zero Focus')).toBe('strategic_framing:sprint_zero_focus')
    expect(isEditableSummaryFieldKey('strategic_framing:sprint_zero_focus')).toBe(true)
    expect(summaryFieldLabel('strategic_framing:sprint_zero_focus')).toBe('Strategic Framing · Sprint Zero Focus')
  })

  it('never treats a Governance Readiness signal as editable', () => {
    const key = readinessAnchorKey('Postur eksekusi')
    expect(key).toBe('governance_readiness:postur_eksekusi')
    expect(isEditableSummaryFieldKey(key)).toBe(false)
    expect(summaryFieldLabel(key, 'Postur eksekusi')).toBe('Governance Readiness · Postur eksekusi')
  })

  it('keeps the card labels', () => {
    expect(summaryFieldLabel('value_thesis')).toBe('Value Thesis')
    expect(isEditableSummaryFieldKey('summary_title')).toBe(false)
  })
})

describe('scoring dimension rationale', () => {
  it('uses the idea-backlog key and an explicit label; the score itself is no field', () => {
    expect(scoringFieldKey('business_value')).toBe('scoring:business_value')
    expect(isEditableSummaryFieldKey('scoring:roi')).toBe(true)
    expect(isEditableSummaryFieldKey('scoring:total')).toBe(false)
    expect(summaryFieldLabel('scoring:risk')).toBe('Risk rationale')
  })
})
