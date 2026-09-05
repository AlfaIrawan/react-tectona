import { describe, expect, it } from 'vitest'
import type { WacMembershipDto } from '@/lib/api/workspaceAccessControlApi'
import {
  AGENT_RUNTIME_CONTACTS,
  buildChatContactsFromWorkspaceMembers,
  explainerContactId,
  mergeExplainerContacts,
  isPlaceholderChatContactName,
  pickChatDirectoryWorkspaceIds,
  resolveActiveWorkspaceMembershipRows,
  shouldIncludeIdentityUserInChatDirectory,
  shouldLookupIdentityUserById,
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

  it('keeps the active tenant plus membership workspaces in single mode', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'single', workspaceId: 'ws-a', tenantMode: 'organization' },
      membershipWorkspaceIds: ['ws-b'],
    })
    expect(ids.sort()).toEqual(['ws-a', 'ws-b'].sort())
  })

  it('does not WAC-list catalog org workspaces the user is not a member of', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'single', workspaceId: 'ws-personal', tenantMode: 'personal' },
      membershipWorkspaceIds: ['ws-personal'],
    })
    expect(ids).toEqual(['ws-personal'])
  })

  it('still lists members of other membership workspaces when a personal tenant is selected', () => {
    const ids = pickChatDirectoryWorkspaceIds({
      scope: { mode: 'single', workspaceId: 'ws-personal', tenantMode: 'personal' },
      membershipWorkspaceIds: ['ws-personal', 'ws-org-home'],
    })
    expect(ids.sort()).toEqual(['ws-org-home', 'ws-personal'].sort())
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

  it('omits bootstrap Administrator from New chat', () => {
    const contacts = buildChatContactsFromWorkspaceMembers(
      new Set(['00000000-0000-0000-0000-000000000002', 'member-a']),
      [
        {
          id: '00000000-0000-0000-0000-000000000002',
          email: 'administrator@tectona.local',
          display_name: 'Administrator',
          status_code: 'active',
        },
        {
          id: 'member-a',
          email: 'member.a@adira.co.id',
          display_name: 'Member A',
          status_code: 'active',
        },
      ],
    )
    expect(contacts.some((contact) => contact.id === '00000000-0000-0000-0000-000000000002')).toBe(false)
    expect(contacts.some((contact) => contact.id === 'member-a')).toBe(true)
  })
})

describe('shouldLookupIdentityUserById', () => {
  it('does not GET by id when the identity list already loaded', () => {
    expect(
      shouldLookupIdentityUserById(
        'e6ba7c48-1395-4661-bbd6-3868419de2d6',
        new Set(),
        true,
        new Set(),
      ),
    ).toBe(false)
  })

  it('does not retry ids that already 404d', () => {
    const id = '4c58d169-6339-42d5-9d25-aa000ce1f77e'
    expect(shouldLookupIdentityUserById(id, new Set(), false, new Set([id]))).toBe(false)
  })

  it('looks up by id only when the directory list failed', () => {
    expect(shouldLookupIdentityUserById('abc', new Set(), false, new Set())).toBe(true)
  })
})

describe('shouldIncludeIdentityUserInChatDirectory', () => {
  it('includes Adira colleagues when the session is a local tectona account', () => {
    expect(
      shouldIncludeIdentityUserInChatDirectory(
        { email: 'v.christophe.harnanto@adira.co.id', status_code: 'active' },
        'alfa.irawan.local@tectona.local',
      ),
    ).toBe(true)
  })

  it('hides bootstrap Administrator and Root', () => {
    expect(
      shouldIncludeIdentityUserInChatDirectory(
        {
          id: '00000000-0000-0000-0000-000000000002',
          email: 'administrator@tectona.local',
          status_code: 'active',
        },
        'alfa.irawan@local.adira.co.id',
      ),
    ).toBe(false)
    expect(
      shouldIncludeIdentityUserInChatDirectory(
        {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'root@tectona.local',
          status_code: 'active',
        },
        'alfa.irawan@local.adira.co.id',
      ),
    ).toBe(false)
  })

  it('does not list unrelated consumer emails', () => {
    expect(
      shouldIncludeIdentityUserInChatDirectory(
        { email: 'someone@gmail.com', status_code: 'active' },
        'alfa.irawan.local@tectona.local',
      ),
    ).toBe(false)
  })
})

describe('isPlaceholderChatContactName', () => {
  it('treats Team member and UUID labels as placeholders', () => {
    expect(isPlaceholderChatContactName('Team member')).toBe(true)
    expect(isPlaceholderChatContactName('Member a1b2c3d4')).toBe(true)
    expect(isPlaceholderChatContactName('Alfa Irawan')).toBe(false)
  })
})

describe('mergeExplainerContacts', () => {
  const john = {
    id: explainerContactId('a1'),
    assistantId: 'a1',
    name: 'John',
    subtitle: 'Penjelas MI Kredit',
    mode: 'genai' as const,
    initials: 'JO',
    isAssistant: true,
  }

  it('replaces the coming-soon placeholder that shares the pack name', () => {
    const merged = mergeExplainerContacts(AGENT_RUNTIME_CONTACTS, [john])
    const johns = merged.filter((contact) => contact.name === 'John')
    expect(johns).toHaveLength(1)
    expect(johns[0].assistantId).toBe('a1')
    expect(johns[0].disabled).toBeUndefined()
  })

  it('keeps the default assistant and unrelated placeholders', () => {
    const merged = mergeExplainerContacts(AGENT_RUNTIME_CONTACTS, [john])
    expect(merged.find((contact) => contact.id === TECTONA_ASSISTANT_CONTACT.id)).toBeDefined()
    expect(merged.find((contact) => contact.name === 'Vanya')?.disabled).toBe(true)
  })

  it('is a no-op when no packs are published', () => {
    expect(mergeExplainerContacts(AGENT_RUNTIME_CONTACTS, [])).toBe(AGENT_RUNTIME_CONTACTS)
  })
})
