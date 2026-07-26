import { describe, expect, it } from 'vitest'
import {
  BACKEND_DISCONNECTED_MESSAGE,
  buildWorkspaceChatDataSummary,
} from './buildWorkspaceChatDataSummary'

describe('buildWorkspaceChatDataSummary', () => {
  it('returns backend fallback when workspace-org is unavailable', () => {
    const summary = buildWorkspaceChatDataSummary({
      workspaceOrgBackendConnected: false,
      workspaces: [],
      statusCounts: new Map(),
      governanceHealthDistribution: [],
    })

    expect(summary).toBe(BACKEND_DISCONNECTED_MESSAGE)
  })

  it('includes actual workspace names in assistant context', () => {
    const summary = buildWorkspaceChatDataSummary({
      workspaceOrgBackendConnected: true,
      workspaces: [
        { name: 'Alpha Delivery', status: 'Active', healthBand: 'At Risk' },
        { name: 'Beta PMO', status: 'Active', healthBand: 'Healthy' },
        { name: 'Gamma Ops', status: 'Archived', healthBand: 'Critical' },
      ],
      statusCounts: new Map([
        ['Active', 2],
        ['At Risk', 0],
        ['Archived', 1],
      ]),
      governanceHealthDistribution: [
        { name: 'Healthy', value: 1 },
        { name: 'At Risk', value: 1 },
        { name: 'Critical', value: 1 },
      ],
    })

    expect(summary).toContain('Alpha Delivery [status=Active, health=At Risk]')
    expect(summary).toContain('Beta PMO [status=Active, health=Healthy]')
    expect(summary).toContain('Gamma Ops [status=Archived, health=Critical]')
  })

  it('truncates long workspace lists without exceeding the payload limit', () => {
    const summary = buildWorkspaceChatDataSummary({
      workspaceOrgBackendConnected: true,
      workspaces: Array.from({ length: 8 }, (_, index) => ({
        name: `Workspace ${index + 1} dengan nama yang cukup panjang`,
        status: 'Active' as const,
        healthBand: 'At Risk' as const,
      })),
      statusCounts: new Map([
        ['Active', 8],
        ['At Risk', 0],
        ['Archived', 0],
      ]),
      governanceHealthDistribution: [
        { name: 'Healthy', value: 0 },
        { name: 'At Risk', value: 8 },
        { name: 'Critical', value: 0 },
      ],
      maxLength: 320,
    })

    expect(summary.length).toBeLessThanOrEqual(320)
    expect(summary).toContain('Workspace terdaftar pada layar:')
  })
})
