import { describe, expect, it } from 'vitest'

import type { AccessRequestDto } from '@/lib/api/workspaceAccessControlApi'

import {
  approveAccessRequestDescription,
  pendingAccessRequestDisplay,
  resolveAccessRequestJoinWorkspace,
} from './accessRequestWorkspaceDisplay'

const catalog = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Adira Finance WS',
    isPersonalWorkspace: false,
    type: 'Organization',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Henry Halim WS',
    isPersonalWorkspace: true,
    type: 'Personal',
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'IT Business Partner WS',
    isPersonalWorkspace: false,
    type: 'Directorate',
  },
]

function req(partial: Partial<AccessRequestDto>): AccessRequestDto {
  return {
    id: 'req-1',
    app_id: 'tectona',
    workspace_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    subject_id: 'sub-henry',
    status_code: 'pending',
    ...partial,
  }
}

describe('resolveAccessRequestJoinWorkspace', () => {
  it('resolves personal workspace from workspace_id and catalog', () => {
    expect(resolveAccessRequestJoinWorkspace(req({}), catalog)).toEqual({
      workspaceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      workspaceName: 'Henry Halim WS',
      kind: 'personal',
      kindLabel: 'Personal workspace',
    })
  })

  it('prefers message marker when workspace_id is the review org workspace', () => {
    expect(
      resolveAccessRequestJoinWorkspace(
        req({
          workspace_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          request_message:
            'Request to join organization directory. [operational_workspace_id=cccccccc-cccc-cccc-cccc-cccccccccccc]',
        }),
        catalog,
      ),
    ).toEqual({
      workspaceId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      workspaceName: 'IT Business Partner WS',
      kind: 'operational',
      kindLabel: 'Operational workspace',
    })
  })

  it('prefers personal marker when workspace_id is the review org workspace', () => {
    expect(
      resolveAccessRequestJoinWorkspace(
        req({
          workspace_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          request_message:
            'Request to join organization directory. [personal_workspace_id=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb]',
        }),
        catalog,
      ),
    ).toEqual({
      workspaceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      workspaceName: 'Henry Halim WS',
      kind: 'personal',
      kindLabel: 'Personal workspace',
    })
  })

  it('parses operational marker when workspace_id is missing', () => {
    expect(
      resolveAccessRequestJoinWorkspace(
        req({
          workspace_id: '',
          request_message:
            'Please approve [operational_workspace_id=cccccccc-cccc-cccc-cccc-cccccccccccc]',
        }),
        catalog,
      ),
    ).toMatchObject({
      workspaceId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      workspaceName: 'IT Business Partner WS',
      kind: 'operational',
    })
  })
})

describe('pendingAccessRequestDisplay', () => {
  it('shows workspace name for corporate onboarding join request', () => {
    expect(
      pendingAccessRequestDisplay(
        req({
          workspace_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          request_message:
            'Request to join organization directory. [personal_workspace_id=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb]',
        }),
        catalog,
      ),
    ).toEqual({
      detail: 'Henry Halim WS · Personal workspace',
      note: 'Awaiting approval to join the organization directory.',
      joinWorkspace: {
        workspaceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        workspaceName: 'Henry Halim WS',
        kind: 'personal',
        kindLabel: 'Personal workspace',
      },
    })
  })
})

describe('approveAccessRequestDescription', () => {
  it('names the workspace being linked', () => {
    expect(
      approveAccessRequestDescription(
        {
          workspaceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          workspaceName: 'Henry Halim WS',
          kind: 'personal',
          kindLabel: 'Personal workspace',
        },
        'Adira Finance WS',
      ),
    ).toBe(
      'Grant access and link Henry Halim WS (personal workspace) under Adira Finance WS.',
    )
  })

  it('uses name override when workspace is outside filtered directory view', () => {
    expect(
      resolveAccessRequestJoinWorkspace(
        req({
          workspace_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          request_message:
            'Request to join organization directory. [operational_workspace_id=cccccccc-cccc-cccc-cccc-cccccccccccc]',
        }),
        catalog.filter((row) => row.id !== 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
        { 'cccccccc-cccc-cccc-cccc-cccccccccccc': 'IT Business Partner WS' },
      ),
    ).toMatchObject({
      workspaceName: 'IT Business Partner WS',
    })
  })
})
