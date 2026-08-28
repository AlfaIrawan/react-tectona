import { describe, expect, it } from 'vitest'

import {
  canReparentOperationalWorkspace,
  collectWorkspaceDescendantIds,
  listOperationalDirectoryReparentTargets,
} from './operationalDirectoryReparent'

const org = {
  id: 'org-home',
  type: 'Organization',
  isPersonalWorkspace: false,
  primaryOrganizationId: 'adira',
  parentWorkspaceId: null,
  name: 'Adira Finance',
}

const division = {
  id: 'div',
  type: 'Division',
  isPersonalWorkspace: false,
  primaryOrganizationId: 'adira',
  parentWorkspaceId: 'org-home',
  name: 'IT Data WS',
}

const department = {
  id: 'dept',
  type: 'Department',
  isPersonalWorkspace: false,
  primaryOrganizationId: 'adira',
  parentWorkspaceId: null,
  name: 'IT Data AI & Innovation WS',
}

const personal = {
  id: 'personal',
  type: 'Personal',
  isPersonalWorkspace: true,
  primaryOrganizationId: 'adira',
  parentWorkspaceId: 'dept',
  name: 'Christophe Samuel',
}

describe('operational directory reparent', () => {
  it('allows moving a department, not a personal or org home workspace', () => {
    expect(canReparentOperationalWorkspace(department)).toBe(true)
    expect(canReparentOperationalWorkspace(personal)).toBe(false)
    expect(canReparentOperationalWorkspace(org)).toBe(false)
  })

  it('lists division and org home as targets for a department', () => {
    const targets = listOperationalDirectoryReparentTargets(department, [org, division, department, personal])
    expect(targets.map((row) => row.id).sort()).toEqual(['div', 'org-home'].sort())
  })

  it('does not list a department as a parent for a division', () => {
    const targets = listOperationalDirectoryReparentTargets(division, [org, division, department, personal])
    expect(targets.map((row) => row.id)).toEqual(['org-home'])
  })

  it('excludes descendants to prevent cycles', () => {
    const nested = { ...department, parentWorkspaceId: 'div' }
    expect(collectWorkspaceDescendantIds('div', [org, division, nested, personal]).has('dept')).toBe(true)
    const targets = listOperationalDirectoryReparentTargets(division, [org, division, nested, personal])
    expect(targets.some((row) => row.id === 'dept')).toBe(false)
  })
})
