import { describe, expect, it } from 'vitest'
import type { WacMembershipDto } from '@/lib/api/workspaceAccessControlApi'
import {
  buildChatContactsFromWorkspaceMembers,
  pickChatDirectoryWorkspaceIds,
  resolveActiveWorkspaceMembershipRows,
  TECTONA_ASSISTANT_CONTACT,
} from './chatContactDirectory'

describe('resolveActiveWorkspaceMembershipRows', () => {
  it('prefers active membership rows', () => {
    const rows: WacMembershipDto[] = [
      { id: '1', app_id: 'a', workspace_id: 'w', subject_id: 'u1', role_id: 'r', role_code: 'Member', version: 1, status_code: 'revoked' },
      { id: '2', app_id: 'a', workspace_id: 'w', subject_id: 'u2', role_id: 'r', role_code: 'Member', version: 1, status_code: 'active' },
    ]
    expect(resolveActiveWorkspaceMembershipRows(rows).map((row) => row.subject_id)).toEqual(['u2'])
  })
})

describe('pickChatDirectoryWorkspaceIds', () => {
  it('uses only membership workspaces in all-workspaces mode', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'all' },
      membershipWorkspaceIds: ['ws-a', 'ws-b'],
    })
    expect(ids).toEqual(['ws-a', 'ws-b'])
  })

  it('intersects multi-select with membership', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'all', workspaceIds: ['ws-a', 'ws-x'] },
      membershipWorkspaceIds: ['ws-a', 'ws-b'],
    })
    expect(ids).toEqual(['ws-a'])
  })

  it('scopes single workspace to active tenant', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'single', workspaceId: 'ws-a', tenantMode: 'organization' },
      membershipWorkspaceIds: ['ws-b'],
    })
    expect(ids).toEqual(['ws-a'])
  })
})

describe('buildChatContactsFromWorkspaceMembers', () => {
  it('includes assistant and only allowed workspace member subjects', () => {
    const contacts = buildChatContactsFromWorkspaceMembers(new Set(['member-a']), [
      {
        id: 'member-a',
        email: 'member.a@adira.co.id',
        display_name: 'Member A',
        status_code: 'active',
      },
      {
        id: 'outsider',
        email: 'outsider@gmail.com',
        display_name: 'Outsider',
        status_code: 'active',
      },
    ])
    expect(contacts[0]).toEqual(TECTONA_ASSISTANT_CONTACT)
    expect(contacts.some((contact) => contact.id === 'outsider')).toBe(false)
    expect(contacts.some((contact) => contact.id === 'member-a')).toBe(true)
  })
})
