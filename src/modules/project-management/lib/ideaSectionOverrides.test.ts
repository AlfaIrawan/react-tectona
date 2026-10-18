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

  it('decides an audience by department, job title or group workspace for the viewer', () => {
    const change = { diagrams: { visibility: 'show' as const, audience: ['IT Business Partner WS'], audience_by: 'workspace', diagram_types: { technical: [], bpmn: [] } } }
    const member = applyIdeaSectionOverrides({ ...map }, audience, change, (by, names) => by === 'workspace' && names.includes('IT Business Partner WS'))
    expect(member.visibility.diagrams).toBe('show')
    expect(ideaMenuForWorkflowAudience(undefined, member.visibility, [], member.audience)).toContain('diagrams')

    // Someone else keeps what the workflow set: hidden, still shown to its teams.
    const other = applyIdeaSectionOverrides({ ...map }, audience, change, () => false)
    expect(other.visibility.diagrams).toBe('hide')
    expect(other.audience?.alsoShowTo.diagrams).toEqual(['Architecture', 'Business Partner'])
    expect(other.audience?.diagramTypes).toEqual(audience.diagramTypes)

    // A section the workflow showed to everyone is limited to the matched people.
    const limited = applyIdeaSectionOverrides({ ...map }, audience, {
      document: { visibility: 'show', audience: ['PMO'], audience_by: 'department' },
    }, () => false)
    expect(limited.visibility.document).toBe('hide')

    // Hide, still shown to a job title.
    const hidden = applyIdeaSectionOverrides({ ...map }, audience, {
      document: { visibility: 'hide', audience: ['Head of PMO'], audience_by: 'jobTitle' },
    }, (by) => by === 'jobTitle')
    expect(hidden.visibility.document).toBe('show')
  })

  it('ignores unknown sections and values', () => {
    const next = applyIdeaSectionOverrides({ ...map }, audience, {
      nope: { visibility: 'show' },
      summary: { visibility: 'maybe' as 'show' },
    })
    expect(next).toEqual({ visibility: map, audience })
  })
})
