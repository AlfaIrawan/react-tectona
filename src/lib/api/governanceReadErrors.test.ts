// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './httpClient'
import { fetchGovernanceCatalogSnapshot } from './governanceConfigurationApi'
import { fetchWorkspaceGovernanceAssignments } from './workspaceGovernanceApi'
import { readWorkspaceGovernanceResource, settleWorkspaceGovernanceReads, workspaceGovernanceFailure, workspaceReadFailure } from '@/modules/workspace-management/lib/workspaceManagementReadState'

vi.mock('./httpClient', () => ({
  apiFetch: vi.fn(),
  tectonaServiceHeaders: vi.fn(),
}))
vi.mock('./gatewayBase', () => ({ serviceApiBase: (path: string) => path }))

const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const fetchMock = vi.mocked(apiFetch)

beforeEach(() => fetchMock.mockReset())

describe('Workspace Management governance errors', () => {
  it('keeps 429 on a FastAPI detail payload and reads a fresh catalog when retried', async () => {
    let limited = true
    fetchMock.mockImplementation(async (url) =>
      limited && String(url).endsWith('/workflow-policies')
        ? response({ detail: 'Rate Exceeded' }, 429)
        : response({ items: [] }),
    )
    const failure = await fetchGovernanceCatalogSnapshot().catch((error: unknown) => error)
    expect(failure).toMatchObject({ errors: [{ status: 429, resource: 'Governance workflow policies' }] })
    expect(workspaceGovernanceFailure(failure).reason).toContain('HTTP 429')
    limited = false
    await expect(fetchGovernanceCatalogSnapshot()).resolves.toMatchObject({ workflowPolicies: [] })
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/workflow-policies'))).toHaveLength(2)
  })

  it('keeps a 403 and classifies it separately from a network failure', async () => {
    fetchMock.mockResolvedValue(response({ detail: 'Workspace access denied' }, 403))
    const failure = await fetchWorkspaceGovernanceAssignments().catch((error: unknown) => error)
    expect(failure).toMatchObject({ status: 403, message: 'Workspace access denied' })
    expect(workspaceReadFailure('The governance service', failure).reason).toContain('permission')
  })
})

it('identifies the failing governance read without exposing service error bodies', async () => {
  fetchMock.mockImplementation(async (url) =>
    String(url).endsWith('/sla-policies')
      ? response({ detail: 'private backend detail' }, 500)
      : response({ items: [] }),
  )
  const failure = await fetchGovernanceCatalogSnapshot().catch((error: unknown) => error)
  expect(failure).toMatchObject({ errors: [{ status: 500, resource: 'Governance SLA policies' }] })
  expect(workspaceGovernanceFailure(failure).reason)
    .toBe('Governance SLA policies could not complete the request (HTTP 500).')
  expect(String(failure)).not.toContain('private backend detail')
})

it('reports catalog and assignment failures together, in a stable order', async () => {
  fetchMock.mockImplementation(async (url) =>
    /\/(templates|naming-conventions|assignments)$/.test(String(url))
      ? response({ detail: 'private backend detail' }, 500)
      : response({ items: [] }),
  )
  const failure = await settleWorkspaceGovernanceReads([
    fetchGovernanceCatalogSnapshot(),
    readWorkspaceGovernanceResource('Governance assignments', fetchWorkspaceGovernanceAssignments),
  ] as const).catch((error: unknown) => error)
  expect(workspaceGovernanceFailure(failure).reason).toBe(
    'Governance templates could not complete the request (HTTP 500). '
      + 'Governance naming conventions could not complete the request (HTTP 500). '
      + 'Governance assignments could not complete the request (HTTP 500).',
  )
})
