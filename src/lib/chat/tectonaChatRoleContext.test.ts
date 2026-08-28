import { describe, expect, it } from 'vitest'
import type { WacMembershipDto } from '@/lib/api/workspaceAccessControlApi'
import { buildChatRoleSnapshot } from './tectonaChatRoleContext'

describe('buildChatRoleSnapshot', () => {
  const memberships: WacMembershipDto[] = [
    {
      id: 'm1',
      app_id: 'app',
      workspace_id: 'ws-1',
      subject_id: 'user-1',
      role_id: 'r1',
      role_code: 'member',
      version: 1,
    },
  ]

  it('maps member role to read-only governance flags', () => {
    const snapshot = buildChatRoleSnapshot({
      platformRoles: [],
      workspaceId: 'ws-1',
      memberships,
    })
    expect(snapshot.workspace_role).toBe('Member')
    expect(snapshot.can_manage_members).toBe(false)
    expect(snapshot.can_view_governance).toBe(false)
  })

  it('grants full flags for platform admin', () => {
    const snapshot = buildChatRoleSnapshot({
      platformRoles: ['tectona_admin'],
      uiRole: 'admin',
      workspaceId: 'ws-1',
      memberships,
    })
    expect(snapshot.is_platform_admin).toBe(true)
    expect(snapshot.can_manage_governance).toBe(true)
  })
})
