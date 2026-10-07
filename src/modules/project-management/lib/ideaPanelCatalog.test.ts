import { describe, expect, it } from 'vitest'
import { visibleIdeaNavSections } from '@/modules/project-management/lib/ideaPanelCatalog'

describe('visibleIdeaNavSections', () => {
  it('keeps every catalog section when the workflow has no map', () => {
    expect(visibleIdeaNavSections(undefined, {})).toEqual([
      'summary',
      'scoring',
      'impact',
      'diagrams',
      'costBenefit',
      'conversion',
      'document',
    ])
  })

  it('hides only the sections a workflow marked hide', () => {
    expect(visibleIdeaNavSections(undefined, { scoring: 'hide', document: 'hide' })).toEqual([
      'summary',
      'impact',
      'diagrams',
      'costBenefit',
      'conversion',
    ])
  })

  it('keeps Summary when every section is hidden', () => {
    expect(
      visibleIdeaNavSections(undefined, {
        summary: 'hide',
        scoring: 'hide',
        impact: 'hide',
        diagrams: 'hide',
        costBenefit: 'hide',
        conversion: 'hide',
        document: 'hide',
      }),
    ).toEqual(['summary'])
  })
})
