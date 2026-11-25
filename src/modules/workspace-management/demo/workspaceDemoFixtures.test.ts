import { describe, expect, it } from 'vitest'
import { buildWorkspaceDemo, demoScenarios } from './workspaceDemoFixtures'

const cases = [
  { scenario: 'enterprise', headcounts: [720, 1080, 1200, 1000], subsidiaries: 3, workspaces: 12 },
  { scenario: 'smb', headcounts: [20, 180, 95, 70, 85, 50], subsidiaries: 0, workspaces: 3 },
  { scenario: 'startup', headcounts: [50], subsidiaries: 0, workspaces: 1 },
] as const

describe('local Workspace Management fixtures', () => {
  it.each(cases)('reproduces the $scenario headcount and structure', ({ scenario, headcounts, subsidiaries, workspaces }) => {
    const data = buildWorkspaceDemo(scenario)
    expect(buildWorkspaceDemo(scenario)).toEqual(data)
    expect(data.employees).toHaveLength(headcounts.reduce<number>((total, count) => total + count, 0))
    const company = data.organizations[0]
    expect(company).toMatchObject({ kind: 'Company', parentId: null })
    expect(data.organizations.slice(1).every((org) => org.parentId === company.id)).toBe(true)
    expect(data.organizations.filter((org) => org.kind === 'Subsidiary')).toHaveLength(subsidiaries)
    expect(data.organizations.map((org) => data.employees.filter((employee) => employee.organizationId === org.id).length))
      .toEqual(headcounts)
    expect(data.workspaces).toHaveLength(workspaces)
    expect(data.fixtureEmailDomain).toMatch(/\.test$/)
  })

  it.each(demoScenarios)('keeps %s workspace access and ownership internally consistent', (scenario) => {
    const data = buildWorkspaceDemo(scenario)
    const orgIds = new Set(data.organizations.map((org) => org.id))
    const workspaces = new Map(data.workspaces.map((workspace) => [workspace.id, workspace]))
    const employees = new Map(data.employees.map((employee) => [employee.id, employee]))
    const access = new Map(data.memberships.map((entry) => [`${entry.employeeId}/${entry.workspaceId}`, entry.role]))
    expect(access.size).toBe(data.memberships.length)
    if (scenario === 'startup') expect(access.size).toBe(employees.size)
    else expect(access.size).toBeGreaterThan(employees.size)
    expect(new Set(access.values())).toEqual(new Set(['admin', 'editor', 'member', 'viewer']))
    for (const employee of employees.values()) {
      const home = workspaces.get(employee.homeWorkspaceId)
      expect(Boolean(home && [home.organizationId, ...home.relatedOrganizationIds].includes(employee.organizationId))).toBe(true)
      expect(access.has(`${employee.id}/${employee.homeWorkspaceId}`)).toBe(true)
      expect(employee.email.endsWith(`@${data.fixtureEmailDomain}`)).toBe(true)
    }
    for (const workspace of workspaces.values()) {
      expect(orgIds.has(workspace.organizationId)).toBe(true)
      expect(workspace.relatedOrganizationIds.every((id) => id !== workspace.organizationId && orgIds.has(id))).toBe(true)
      expect(employees.get(workspace.ownerId)?.homeWorkspaceId).toBe(workspace.id)
      expect(access.get(`${workspace.ownerId}/${workspace.id}`)).toBe('admin')
      const path = new Set([workspace.id])
      let parentId = workspace.parentId
      while (parentId) {
        expect(path.has(parentId)).toBe(false)
        path.add(parentId)
        const parent = workspaces.get(parentId)
        expect(parent?.organizationId).toBe(workspace.organizationId)
        parentId = parent?.parentId ?? null
      }
    }
    for (const membership of data.memberships) {
      const organizationId = employees.get(membership.employeeId)?.organizationId
      const workspace = workspaces.get(membership.workspaceId)
      expect(Boolean(organizationId && workspace && [workspace.organizationId, ...workspace.relatedOrganizationIds].includes(organizationId))).toBe(true)
    }
  })

  it('gives every tenant, organization, workspace and person a distinct ID and isolates email domains', () => {
    const datasets = demoScenarios.map((scenario) => buildWorkspaceDemo(scenario))
    const ids = datasets.flatMap((data) => {
      const records = [...data.organizations, ...data.workspaces, ...data.employees]
      expect(records.every((record) => record.id.startsWith(`${data.tenantId}:`))).toBe(true)
      return [data.tenantId, ...records.map((record) => record.id)]
    })
    const domains = datasets.map((data) => data.fixtureEmailDomain)
    const employees = datasets.flatMap((data) => data.employees)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(domains).size).toBe(datasets.length)
    expect(new Set(employees.map((employee) => employee.email)).size).toBe(employees.length)
    expect(new Set(employees.map((employee) => employee.name)).size).toBe(employees.length)
  })

  it.each(['smb', 'startup'] as const)('keeps %s identities stable and adds no workspace admins during consolidation', (scenario) => {
    const before = buildWorkspaceDemo(scenario, 'before-consolidation')
    const after = buildWorkspaceDemo(scenario)
    const identityFields = ({ id, email, name, organizationId, team }: typeof after.employees[number]) =>
      [id, email, name, organizationId, team]
    expect(after.employees.map(identityFields)).toEqual(before.employees.map(identityFields))

    const admins = (data: typeof after) => data.memberships.filter((entry) => entry.role === 'admin')
    expect(admins(after)).toEqual(admins(before).filter((entry) =>
      after.workspaces.some((workspace) => workspace.id === entry.workspaceId),
    ))
  })
})
