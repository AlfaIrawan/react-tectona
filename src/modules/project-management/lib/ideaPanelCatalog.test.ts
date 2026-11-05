import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IDEA_SECTION_AUDIENCE,
  ideaDiagramTypesFor,
  isIdeaDiagramOwner,
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
  it('shows every diagram type to a Business Partner owner with legacy workflow settings', () => {
    expect(ideaDiagramTypesFor(['IT Business Partner'], null, true)).toEqual({ technical: true, bpmn: true })
    const menu = ideaMenuForWorkflowAudience(undefined, docsOnly, ['IT Business Partner'], null, undefined, false, true)
    expect(menu).toEqual(['diagrams', 'document'])
  })

  it('lets an owner review an explicitly visible section without architecture membership', () => {
    expect(ideaMenuForWorkflowAudience(undefined, { ...docsOnly, diagrams: 'show' }, [], null, undefined, false, true))
      .toEqual(['diagrams', 'document'])
    expect(ideaDiagramTypesFor([], null, true)).toEqual({ technical: true, bpmn: true })
  })

  it('keeps hidden sections hidden unless the creator review option explicitly shows them', () => {
    const audience = readIdeaSectionAudience({ alsoShowTo: { diagrams: [] } })
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, [], audience, undefined, false, true)).toEqual(['document'])
    expect(ideaMenuForWorkflowAudience(undefined, docsOnly, [], audience, undefined, true, true)).toEqual(['diagrams', 'document'])
  })

  it('does not grant another Business Partner the owner exception', () => {
    expect(ideaDiagramTypesFor(['IT Business Partner'], null, isIdeaDiagramOwner('other', 'owner', 'creator')))
      .toEqual({ technical: false, bpmn: true })
  })

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

describe('isIdeaDiagramOwner', () => {
  it('matches the stored owner or creator identity', () => {
    expect(isIdeaDiagramOwner('owner', 'owner', 'creator')).toBe(true)
    expect(isIdeaDiagramOwner('creator', 'owner', 'creator')).toBe(true)
    expect(isIdeaDiagramOwner('owner', ' owner ')).toBe(true)
  })

  it('does not infer ownership from missing identities or partial display names', () => {
    expect(isIdeaDiagramOwner(undefined, 'owner')).toBe(false)
    expect(isIdeaDiagramOwner('owner', undefined, undefined)).toBe(false)
    expect(isIdeaDiagramOwner('', '')).toBe(false)
    expect(isIdeaDiagramOwner('Alfa', 'Alfa Irawan')).toBe(false)
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
