import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWorkflow, listWorkflows } from '@/lib/api/workflowAutomationApi'
import { loadPublishedIdeaSectionPolicy } from './ideaDocumentWorkflowGate'

vi.mock('@/lib/api/workflowAutomationApi', () => ({ getWorkflow: vi.fn(), listWorkflows: vi.fn(), listWorkflowApprovals: vi.fn() }))

const graph = (keys: string[]) => ({ nodes: [{ id: 'start', data: { kind: 'trigger', config: {
  triggerType: 'Event', triggerDomain: 'AI Idea & Prioritization', triggerEntity: 'Idea',
  ideaSectionOrder: JSON.stringify(keys), audienceBy: 'jobTitle', audienceValues: 'PMO',
} } }], edges: [] })

describe('published section order policy', () => {
  beforeEach(() => vi.resetAllMocks())

  it('uses published order, not an unpublished draft, scoped to the requested workspace', async () => {
    vi.mocked(listWorkflows).mockResolvedValue([{ id: 'wf', is_published: true, status: 'Active' }] as never)
    vi.mocked(getWorkflow).mockResolvedValue({ definition: graph(['summary']), published_definition: graph(['document', 'diagrams']) } as never)
    const policy = await loadPublishedIdeaSectionPolicy('portfolio')
    expect(listWorkflows).toHaveBeenCalledWith('portfolio')
    expect(policy.sectionOrder?.slice(0, 2)).toEqual(['document', 'diagrams'])
    expect(policy.audience).toEqual({ by: 'jobTitle', values: ['PMO'] })
    expect(policy.map).toEqual({})
  })

  it('skips inactive/unpublished workflows and preserves the legacy fallback', async () => {
    vi.mocked(listWorkflows).mockResolvedValue([
      { id: 'draft', is_published: false, status: 'Active' },
      { id: 'inactive', is_published: true, status: 'Inactive' },
      { id: 'legacy', is_published: true, status: 'Active' },
    ] as never)
    vi.mocked(getWorkflow).mockResolvedValue({ published_definition: { nodes: [], edges: [], ideaSections: { document: 'show' } } } as never)
    const policy = await loadPublishedIdeaSectionPolicy('portfolio')
    expect(getWorkflow).toHaveBeenCalledTimes(1)
    expect(getWorkflow).toHaveBeenCalledWith('legacy')
    expect(policy.sectionOrder).toBeUndefined()
    expect(policy.map).toEqual({ document: 'show' })
  })
})
