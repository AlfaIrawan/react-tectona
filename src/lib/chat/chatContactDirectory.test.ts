import { describe, expect, it } from 'vitest'
import type { WacMembershipDto } from '@/lib/api/workspaceAccessControlApi'
import {
  buildChatContactsFromWorkspaceMembers,
  isPlaceholderChatContactName,
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

  it('keeps selected workspaces when membership list is empty (org admin / WAC 403)', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'all', workspaceIds: ['ws-a', 'ws-b'] },
      membershipWorkspaceIds: [],
    })
    expect(ids).toEqual(['ws-a', 'ws-b'])
  })

  it('unions switcher-accessible workspaces when membership fetch is empty', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'all' },
      membershipWorkspaceIds: [],
      accessibleWorkspaceIds: ['ws-a', 'ws-b'],
    })
    expect(ids).toEqual(['ws-a', 'ws-b'])
  })

  it('does not fan out to catalog org workspaces (WAC members 403)', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'all' },
      membershipWorkspaceIds: [],
    })
    expect(ids).toEqual([])
  })

  it('scopes single workspace to active tenant', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'single', workspaceId: 'ws-a', tenantMode: 'organization' },
      membershipWorkspaceIds: ['ws-b'],
    })
    expect(ids).toEqual(['ws-a'])
  })

  it('does not WAC-list every org workspace when a personal workspace is active', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'single', workspaceId: 'ws-personal', tenantMode: 'personal' },
      membershipWorkspaceIds: ['ws-personal'],
    })
    expect(ids).toEqual(['ws-personal'])
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

describe('isPlaceholderChatContactName', () => {
  it('treats Team member and UUID labels as placeholders', () => {
    expect(isPlaceholderChatContactName('Team member')).toBe(true)
    expect(isPlaceholderChatContactName('Member a1b2c3d4')).toBe(true)
    expect(isPlaceholderChatContactName('Alfa Irawan')).toBe(false)
  })
})
