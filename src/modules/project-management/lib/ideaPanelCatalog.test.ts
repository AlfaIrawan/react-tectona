import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IDEA_SECTION_AUDIENCE,
  ideaDiagramTypesFor,
  ideaMenuForWorkflowAudience,
  readIdeaSectionAudience,
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
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, ['Organization Admin'], null)).toEqual(['document'])
  })

  it('adds Diagrams for Architecture and Business Relationship until the workflow sets its own rule', () => {
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, ['Architecture'], null)).toEqual(['diagrams', 'document'])
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, ['IT Business Partner'], null)).toEqual(['diagrams', 'document'])
  })

  it('keeps the order the user dragged the sections into', () => {
    const dragged = ['document', 'diagrams', 'summary', 'scoring', 'impact', 'costBenefit', 'conversion'] as const
    expect(ideaMenuForWorkflowAudience([...dragged], docsOnly, ['Business Partner'], null)).toEqual(['document', 'diagrams'])
    expect(ideaMenuForWorkflowAudience([...dragged], docsOnly, [], null)).toEqual(['document'])
  })

  it('follows the teams the workflow names for a hidden section', () => {
    const audience = readIdeaSectionAudience({
      alsoShowTo: { diagrams: [], summary: ['PMO'] },
      diagramTypes: { technical: ['Architecture'], bpmn: ['Business Partner'] },
    })
    // Diagrams is hidden and shown to nobody now; Summary returns for PMO.
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, ['Business Partner'], audience)).toEqual(['document'])
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, ['Head of PMO'], audience)).toEqual(['summary', 'document'])
  })

  it('shows every section the workflow marks show, not only Docs', () => {
    expect(ideaMenuForWorkflowAudience(undefined, { ...docsOnly, summary: 'show' }, [], null)).toEqual(['summary', 'document'])
  })

  it('leaves Diagrams out for a viewer who may see no diagram type', () => {
    const audience = readIdeaSectionAudience({ diagramTypes: { technical: ['Architecture'], bpmn: ['Business Partner'] } })
    expect(ideaMenuForWorkflowAudience(undefined, { ...docsOnly, diagrams: 'show' }, ['Finance'], audience)).toEqual(['document'])
  })
})

describe('ideaDiagramTypesFor', () => {
  it('uses the old rule when no workflow set one', () => {
    expect(ideaDiagramTypesFor(['Architecture'], null)).toEqual({ technical: true, bpmn: false })
    expect(ideaDiagramTypesFor(['Business Relationship'], null)).toEqual({ technical: false, bpmn: true })
    expect(ideaDiagramTypesFor(['BusinessPartner', 'Arsitektur'], null)).toEqual({ technical: true, bpmn: true })
    expect(ideaDiagramTypesFor(['Organization Admin'], null)).toEqual({ technical: false, bpmn: false })
  })

  it('lets an empty list mean everyone who sees Diagrams', () => {
    const audience = readIdeaSectionAudience({ diagramTypes: { technical: [], bpmn: ['Business Partner'] } })
    expect(ideaDiagramTypesFor(['Finance'], audience)).toEqual({ technical: true, bpmn: false })
  })
})

describe('readIdeaSectionAudience', () => {
  it('is null when the workflow stored none, and fills what an older save left out', () => {
    expect(readIdeaSectionAudience(undefined)).toBeNull()
    const audience = readIdeaSectionAudience({ alsoShowTo: { summary: [' PMO ', 'PMO'] } })
    expect(audience?.alsoShowTo.summary).toEqual(['PMO'])
    expect(audience?.alsoShowTo.diagrams).toEqual(DEFAULT_IDEA_SECTION_AUDIENCE.alsoShowTo.diagrams)
    expect(audience?.diagramTypes).toEqual(DEFAULT_IDEA_SECTION_AUDIENCE.diagramTypes)
  })
})
