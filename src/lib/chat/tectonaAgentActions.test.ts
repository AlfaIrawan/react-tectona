import { describe, expect, it } from 'vitest'
import { buildAgentActionState, formatActionPayloadPreview } from './tectonaAgentActions'

describe('tectonaAgentActions', () => {
  it('builds pending execution map', () => {
    const state = buildAgentActionState([
      {
        action_id: 'a1',
        action_code: 'workspace.create',
        summary: 'Buat workspace',
        payload: { name: 'Portal SSO' },
      },
    ])
    expect(state.executions.a1?.status).toBe('pending')
  })

  it('formats payload preview rows', () => {
    const rows = formatActionPayloadPreview({
      action_id: 'a1',
      action_code: 'workspace.create',
      summary: 'Buat workspace',
      payload: { name: 'Portal SSO', workspace_key: 'portal-sso' },
    })
    expect(rows.some((r) => r.label === 'Nama' && r.value === 'Portal SSO')).toBe(true)
  })
})
