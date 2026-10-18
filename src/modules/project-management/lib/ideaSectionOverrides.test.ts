import { describe, expect, it } from 'vitest'
import { applyIdeaSectionOverrides, ideaMenuForWorkflowAudience, type IdeaSectionAudience } from './ideaPanelCatalog'

const audience: IdeaSectionAudience = {
  alsoShowTo: { diagrams: ['Architecture', 'Business Partner'] },
  diagramTypes: { technical: ['Architecture'], bpmn: ['Business Partner'] },
}
const map = { summary: 'hide', diagrams: 'hide', document: 'show' } as const

describe('applyIdeaSectionOverrides', () => {
  it('leaves the workflow map alone without changes', () => {
    expect(applyIdeaSectionOverrides({ ...map }, audience, {})).toEqual({ visibility: map, audience })
  })

  it('shows a section to everyone, diagram types included when the node opens them', () => {
    const next = applyIdeaSectionOverrides({ ...map }, audience, {
      diagrams: { visibility: 'show', audience: [], diagram_types: { technical: [], bpmn: [] } },
    })
    expect(next.visibility.diagrams).toBe('show')
    // The idea owner (no team) now sees Diagrams with both types.
    expect(ideaMenuForWorkflowAudience(undefined, next.visibility, [], next.audience)).toContain('diagrams')
  })

  it('keeps diagram types restricted when the node does not change them', () => {
    const next = applyIdeaSectionOverrides({ ...map }, audience, { diagrams: { visibility: 'show', audience: [] } })
    expect(next.audience?.diagramTypes).toEqual(audience.diagramTypes)
    // Diagrams without a type the viewer may see would be empty: still left out of the menu.
    expect(ideaMenuForWorkflowAudience(undefined, next.visibility, [], next.audience)).not.toContain('diagrams')
  })

  it('shows to more teams while hidden for the rest, or hides for all but the named ones', () => {
    const shown = applyIdeaSectionOverrides({ ...map }, audience, { summary: { visibility: 'show', audience: ['PMO'] } })
    expect(shown.visibility.summary).toBe('hide')
    expect(shown.audience?.alsoShowTo.summary).toEqual(['PMO'])

    const hidden = applyIdeaSectionOverrides({ ...map }, audience, { document: { visibility: 'hide', audience: [] } })
    expect(hidden.visibility.document).toBe('hide')
    expect(hidden.audience?.alsoShowTo.document).toEqual([])
  })

  it('ignores unknown sections and values', () => {
    const next = applyIdeaSectionOverrides({ ...map }, audience, {
      nope: { visibility: 'show' },
      summary: { visibility: 'maybe' as 'show' },
    })
    expect(next).toEqual({ visibility: map, audience })
  })
})
