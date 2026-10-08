import { describe, expect, it } from 'vitest'
import {
  ideaDiagramAudienceFromLabels,
  ideaMenuForWorkflowAudience,
  visibleIdeaNavSections,
} from '@/modules/project-management/lib/ideaPanelCatalog'

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

const docsOnly = {
  summary: 'hide',
  scoring: 'hide',
  impact: 'hide',
  diagrams: 'hide',
  costBenefit: 'hide',
  conversion: 'hide',
  document: 'show',
} as const

describe('ideaMenuForWorkflowAudience', () => {
  it('keeps Docs only for everyone else', () => {
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, 'none')).toEqual(['document'])
  })

  it('adds Diagrams for Architecture and Business Relationship', () => {
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, 'architecture')).toEqual(['diagrams', 'document'])
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, 'business')).toEqual(['diagrams', 'document'])
  })
})

describe('ideaDiagramAudienceFromLabels', () => {
  it('reads Architecture and Business Relationship from team or role labels', () => {
    expect(ideaDiagramAudienceFromLabels(['Architecture'])).toBe('architecture')
    expect(ideaDiagramAudienceFromLabels(['Business Partner'])).toBe('business')
    expect(ideaDiagramAudienceFromLabels(['Business Relationship', 'Architecture'])).toBe('both')
    expect(ideaDiagramAudienceFromLabels(['Organization Admin'])).toBe('none')
  })
})
