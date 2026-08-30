import { describe, expect, it } from 'vitest'

import type { WacMembershipDto } from '@/lib/api/workspaceAccessControlApi'
import type { WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'

import { resolveSecurityAccess } from './securityAccessPolicy'

const SUBJECT = { id: 'sub-alfa', name: 'Alfa Irawan Local', email: 'alfa@local' }

function workspace(
  id: string,
  extras: Partial<WorkspaceOrgWorkspaceDto> & { classification?: string; parent?: string | null } = {},
): WorkspaceOrgWorkspaceDto {
  const { classification, parent, metadata, ...rest } = extras
  return {
    id,
    organization_id: 'org-adira',
    workspace_key: id,
    name: id,
    status_code: 'active',
    version: 1,
    tenant_mode: rest.tenant_mode ?? 'organization',
    metadata: {
      tectona_workspace_classification: classification ?? 'Department',
      ...(parent ? { parent_workspace_id: parent } : {}),
      ...metadata,
    },
    ...rest,
  }
}

function membership(workspaceId: string, roleCode = 'admin'): WacMembershipDto {
  return {
    id: `m-${workspaceId}`,
    app_id: 'app',
    workspace_id: workspaceId,
    subject_id: SUBJECT.id,
    role_id: 'role',
    role_code: roleCode,
    version: 1,
  }
}

const ORG_HOME = workspace('ws-adira', { classification: 'Organization', tenant_mode: 'organization' })
const INNOLIMIT = workspace('ws-innolimit', {
  classification: 'Division',
  parent: ORG_HOME.id,
  tenant_mode: 'organization',
})
const PERSONAL = workspace('ws-personal', {
  classification: 'Personal',
  tenant_mode: 'personal',
  created_by: SUBJECT.id,
  metadata: { tectona_owner_identity_ref: SUBJECT.id },
})

describe('resolveSecurityAccess', () => {
  it('lets Organization Admin open SAC on org home and descendant workspaces', () => {
    const args = {
      isPlatformAdmin: false,
      isOrganizationAdmin: true,
      items: [membership(PERSONAL.id)],
      workspaces: [ORG_HOME, INNOLIMIT, PERSONAL],
      subject: SUBJECT,
    }
    expect(
      resolveSecurityAccess({ ...args, activeWorkspaceId: ORG_HOME.id, tenantMode: 'organization' }),
    ).toBe(true)
    expect(
      resolveSecurityAccess({ ...args, activeWorkspaceId: INNOLIMIT.id, tenantMode: 'organization' }),
    ).toBe(true)
  })

  it('keeps SAC on a personal tenant even when Organization Admin has no org-home WAC Admin', () => {
    expect(
      resolveSecurityAccess({
        isPlatformAdmin: false,
        isOrganizationAdmin: true,
        items: [membership(PERSONAL.id, 'member')],
        workspaces: [ORG_HOME, PERSONAL],
        activeWorkspaceId: PERSONAL.id,
        tenantMode: 'personal',
        subject: SUBJECT,
      }),
    ).toBe(true)
  })

  it('hides SAC on org descendants when the user is not Organization Admin and has no org-home WAC Admin', () => {
    expect(
      resolveSecurityAccess({
        isPlatformAdmin: false,
        isOrganizationAdmin: false,
        items: [membership(PERSONAL.id), membership(INNOLIMIT.id, 'member')],
        workspaces: [ORG_HOME, INNOLIMIT, PERSONAL],
        activeWorkspaceId: INNOLIMIT.id,
        tenantMode: 'organization',
        subject: SUBJECT,
      }),
    ).toBe(false)
  })

  it('still allows SAC on org descendants when the user is WAC Admin on organization home', () => {
    expect(
      resolveSecurityAccess({
        isPlatformAdmin: false,
        isOrganizationAdmin: false,
        items: [membership(ORG_HOME.id)],
        workspaces: [ORG_HOME, INNOLIMIT],
        activeWorkspaceId: INNOLIMIT.id,
        tenantMode: 'organization',
        subject: SUBJECT,
      }),
    ).toBe(true)
  })
})
