import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWorkflow, getWorkflowVersion, listWorkflows } from '@/lib/api/workflowAutomationApi'
import { ideaContentReviewPolicy, loadPublishedIdeaSectionPolicy } from './ideaDocumentWorkflowGate'
import { ideaMenuForWorkflowAudience } from './ideaPanelCatalog'
import { brainstormTechnicalPersistKey } from '@/lib/chat/extractProcessDiagrams'

vi.mock('@/lib/api/workflowAutomationApi', () => ({
  getWorkflow: vi.fn(), getWorkflowVersion: vi.fn(), listWorkflows: vi.fn(), listWorkflowApprovals: vi.fn(),
}))
const request = (config = {}, disabled = false) => ({
  id: 'request', data: { kind: 'action', disabled, config: { actionOperation: 'Request for Approval', parameter: 'SRD', ...config } },
})

describe('workflow-controlled Idea content review', () => {
  beforeEach(() => vi.resetAllMocks())
  it('is opt-in and ignores disabled actions', () => {
    expect(ideaContentReviewPolicy({ nodes: [request()] } as never).contentReviewEnabled).toBe(false)
    expect(ideaContentReviewPolicy({ nodes: [request({ lockIdeaContentOnApproval: 'true' }, true)] } as never).contentReviewEnabled).toBe(false)
    expect(ideaContentReviewPolicy({ nodes: [request({ lockIdeaContentOnApproval: 'true' })] } as never).contentReviewEnabled).toBe(true)
  })
  it('reads approval policy from the pinned child workflow, not its latest draft', async () => {
    vi.mocked(listWorkflows).mockResolvedValue([{ id: 'parent', is_published: true, status: 'Active' }] as never)
    vi.mocked(getWorkflow).mockResolvedValue({ published_definition: {
      ideaSections: { document: 'show', diagrams: 'hide' },
      nodes: [{ id: 'child', data: { kind: 'callWorkflow', config: { workflowId: 'srd', workflowVersion: '6' } } }],
    } } as never)
    vi.mocked(getWorkflowVersion).mockResolvedValue({ definition: { nodes: [request({
      lockIdeaContentOnApproval: 'true', showIdeaDiagramsBeforeApproval: 'true',
    })] } } as never)
    const policy = await loadPublishedIdeaSectionPolicy('portfolio')
    expect(getWorkflowVersion).toHaveBeenCalledWith('srd', 6)
    expect(policy.contentReviewEnabled).toBe(true)
    expect(policy.creatorDiagramsEnabled).toBe(true)
    expect(policy.requestDocumentKinds).toEqual(['SRD'])
    expect(policy.map.diagrams).toBe('hide')
  })
  it('allows the creator to see Diagrams without broadening other audience sections', () => {
    const map = { diagrams: 'hide', document: 'show', integration: 'hide' } as const
    const menu = ideaMenuForWorkflowAudience(undefined, map, [], null, undefined, true)
    expect(menu).toContain('diagrams')
    expect(menu).toContain('document')
    expect(menu).not.toContain('integration')
    expect(ideaMenuForWorkflowAudience(undefined, map, [], null)).not.toContain('diagrams')
  })
  it('uses stable server keys for technical editor sources', () => {
    expect(brainstormTechnicalPersistKey({ kind: 'c4', source: '@startuml\nContainer(ui, "UI")\n@enduml' } as never)).toBe('brainstorm-c4-level-2')
    expect(brainstormTechnicalPersistKey({ kind: 'c4', source: '@startuml\nSystem(ui, "UI")\n@enduml' } as never)).toBe('brainstorm-c4-level-1')
    expect(brainstormTechnicalPersistKey({ kind: 'erd' } as never)).toBe('brainstorm-erd')
  })
})
