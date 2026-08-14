import { describe, expect, it } from 'vitest'
import {
  applyWorkspaceIdFromWrite,
  belongsToActiveWorkspaceScope,
  resolveWorkspaceIdForFetch,
  resolveWorkspaceIdForWrite,
} from './tenantWorkspaceScope'

describe('applyWorkspaceIdFromWrite', () => {
  it('fills missing workspace_id only for create responses', () => {
    expect(applyWorkspaceIdFromWrite(null, 'ws-henry')).toBe('ws-henry')
    expect(applyWorkspaceIdFromWrite('ws-adira', 'ws-henry')).toBe('ws-adira')
  })
})

describe('belongsToActiveWorkspaceScope', () => {
  const henryScope = { mode: 'single' as const, workspaceId: 'ws-henry', tenantMode: 'personal' as const }
  const adiraScope = { mode: 'single' as const, workspaceId: 'ws-adira', tenantMode: 'organization' as const }

  it('hides untagged legacy rows in personal workspace', () => {
    expect(belongsToActiveWorkspaceScope(null, henryScope)).toBe(false)
    expect(belongsToActiveWorkspaceScope(undefined, henryScope)).toBe(false)
  })

  it('shows untagged legacy rows in organization workspace', () => {
    expect(belongsToActiveWorkspaceScope(null, adiraScope)).toBe(true)
  })

  it('keeps tagged rows scoped to the active workspace', () => {
    expect(belongsToActiveWorkspaceScope('ws-adira', adiraScope)).toBe(true)
    expect(belongsToActiveWorkspaceScope('ws-adira', henryScope)).toBe(false)
    expect(belongsToActiveWorkspaceScope('ws-henry', henryScope)).toBe(true)
  })
})

describe('resolveWorkspaceIdForFetch', () => {
  it('filters on the server for personal workspace only', () => {
    expect(
      resolveWorkspaceIdForFetch({ mode: 'single', workspaceId: 'ws-henry', tenantMode: 'personal' }),
    ).toBe('ws-henry')
    expect(
      resolveWorkspaceIdForFetch({ mode: 'single', workspaceId: 'ws-adira', tenantMode: 'organization' }),
    ).toBeUndefined()
  })
})

describe('resolveWorkspaceIdForWrite', () => {
  it('uses active workspace in single mode', () => {
    expect(
      resolveWorkspaceIdForWrite({ mode: 'single', workspaceId: 'ws-henry', tenantMode: 'personal' }),
    ).toBe('ws-henry')
  })
})
