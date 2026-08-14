import { describe, expect, it } from 'vitest'
import type { IdentityUserDto } from '@/lib/api/identityAdminApi'
import type { WacMembershipDto } from '@/lib/api/workspaceAccessControlApi'
import {
  buildChatContactsFromWorkspaceMembers,
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

describe('buildChatContactsFromWorkspaceMembers', () => {
  const identityUsers: IdentityUserDto[] = [
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
  ]

  it('includes assistant and only allowed workspace member subjects', () => {
    const contacts = buildChatContactsFromWorkspaceMembers(new Set(['member-a']), identityUsers)
    expect(contacts[0]).toEqual(TECTONA_ASSISTANT_CONTACT)
    expect(contacts.some((contact) => contact.id === 'outsider')).toBe(false)
    expect(contacts.some((contact) => contact.id === 'member-a')).toBe(true)
  })

  it('keeps WAC member visible when identity enrichment is missing', () => {
    const contacts = buildChatContactsFromWorkspaceMembers(new Set(['wac-only-id']), identityUsers)
    expect(contacts.some((contact) => contact.id === 'wac-only-id')).toBe(true)
    expect(contacts.some((contact) => contact.id === 'outsider')).toBe(false)
  })
})
