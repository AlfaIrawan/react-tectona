export const demoScenarios = ['enterprise', 'smb', 'startup'] as const
export type DemoScenario = typeof demoScenarios[number]

export const demoRoles = { admin: 'Admin', editor: 'Manager', member: 'Member', viewer: 'Viewer' } as const
export type DemoRole = keyof typeof demoRoles

type OrganizationSpec = { key: string; name: string; kind: 'Subsidiary' | 'Department' }
type WorkspaceSpec = {
  key: string
  name: string
  organization?: string
  parent?: string
  teams: readonly (readonly [team: string, employees: number])[]
}
type ScenarioSpec = {
  company: string
  slug: string
  organizations: readonly OrganizationSpec[]
  workspaces: readonly WorkspaceSpec[]
  sharedWorkspace?: string
}

const scenarios: Record<DemoScenario, ScenarioSpec> = {
  enterprise: {
    company: 'Veylora Transit Group',
    slug: 'veylora-transit',
    organizations: [
      { key: 'rail', name: 'Veylora Rail Systems', kind: 'Subsidiary' },
      { key: 'freight', name: 'Veylora Freight Networks', kind: 'Subsidiary' },
      { key: 'energy', name: 'Veylora Charging Services', kind: 'Subsidiary' },
    ],
    workspaces: [
      { key: 'group', name: 'Group Services', teams: [['People Operations', 100], ['Finance', 130], ['Group Technology', 120]] },
      { key: 'assurance', name: 'Risk & Assurance', parent: 'group', teams: [['Enterprise Risk', 85], ['Internal Audit', 55], ['Security', 70]] },
      { key: 'transformation', name: 'Group Transformation', parent: 'group', teams: [['Portfolio Office', 60], ['Change Management', 100]] },
      { key: 'rail-ops', name: 'Rail Operations', organization: 'rail', teams: [['Control Center', 160], ['Field Operations', 320]] },
      { key: 'fleet', name: 'Fleet Engineering', organization: 'rail', parent: 'rail-ops', teams: [['Maintenance', 240], ['Rolling Stock Engineering', 140]] },
      { key: 'rail-safety', name: 'Rail Safety & Quality', organization: 'rail', parent: 'rail-ops', teams: [['Safety Engineering', 140], ['Quality Assurance', 80]] },
      { key: 'freight-ops', name: 'Freight Operations', organization: 'freight', teams: [['Linehaul', 310], ['Terminal Operations', 290]] },
      { key: 'routing', name: 'Network Planning', organization: 'freight', parent: 'freight-ops', teams: [['Route Design', 170], ['Capacity Planning', 160]] },
      { key: 'shipper', name: 'Shipper Services', organization: 'freight', parent: 'freight-ops', teams: [['Account Delivery', 150], ['Customer Support', 120]] },
      { key: 'charging', name: 'Charging Network', organization: 'energy', teams: [['Site Operations', 280], ['Field Maintenance', 220]] },
      { key: 'deployment', name: 'Infrastructure Delivery', organization: 'energy', parent: 'charging', teams: [['Site Development', 170], ['Electrical Engineering', 130]] },
      { key: 'charging-product', name: 'Charging Products', organization: 'energy', parent: 'charging', teams: [['Product Engineering', 130], ['Partner Operations', 70]] },
    ],
    sharedWorkspace: 'transformation',
  },
  smb: {
    company: 'Morrowfern Foodworks',
    slug: 'morrowfern-foodworks',
    organizations: [
      { key: 'production', name: 'Production', kind: 'Department' },
      { key: 'supply', name: 'Supply Chain', kind: 'Department' },
      { key: 'quality', name: 'Quality & Product', kind: 'Department' },
      { key: 'commercial', name: 'Commercial', kind: 'Department' },
      { key: 'corporate', name: 'Business Services', kind: 'Department' },
    ],
    workspaces: [
      { key: 'hub', name: 'Company Operations', teams: [['Leadership & Planning', 20]] },
      { key: 'plant', name: 'Plant Operations', organization: 'production', teams: [['Production Lines', 145], ['Plant Maintenance', 35]] },
      { key: 'logistics', name: 'Procurement & Distribution', organization: 'supply', teams: [['Procurement', 30], ['Warehouse & Dispatch', 65]] },
      { key: 'quality', name: 'Food Safety & Product', organization: 'quality', teams: [['Quality Assurance', 45], ['Product Development', 25]] },
      { key: 'sales', name: 'Retail & Foodservice', organization: 'commercial', teams: [['Retail Accounts', 50], ['Foodservice & Support', 35]] },
      { key: 'office', name: 'Finance & People', organization: 'corporate', teams: [['Finance & IT', 30], ['People Operations', 20]] },
    ],
    sharedWorkspace: 'hub',
  },
  startup: {
    company: 'Lunewisp Studio',
    slug: 'lunewisp-studio',
    organizations: [],
    workspaces: [
      { key: 'hub', name: 'Company Hub', teams: [['Founders & Operations', 5]] },
      { key: 'product', name: 'Build', teams: [['Engineering', 24], ['Product & Design', 8]] },
      { key: 'growth', name: 'Customer & Growth', teams: [['Customer Success', 8], ['Growth', 5]] },
    ],
    sharedWorkspace: 'hub',
  },
}

const firstNames = (
  'Ada Amara Anika Asha Astrid Audrey Beatrice Bianca Camila Celeste Clara Dalia Elena Elif Elise Emilia ' +
  'Esme Farah Freya Hana Ines Iris Isabel Jade Jia Julia Leila Lena Lina Liv Lucia Maeve ' +
  'Maya Meera Mila Mina Nadia Naomi Nina Noa Nora Nur Olivia Priya Rina Rosa Sara Selin ' +
  'Sofia Tara Vera Yara Aiden Amir Anton Ben Caleb Daniel Dario Elias Emil Felix Hugo Idris ' +
  'Isaac Jun Kian Leo Luca Mateo Noah Omar Ravi Remy Ren Rio Sam Theo Victor Zain'
).split(' ')

const lastNames = (
  'Alcott Alden Almeida Ames Anders Arendt Armitage Avelar Avery Barros Bell Benali Berg Bexley Bouchard Brandt ' +
  'Brenner Calder Campos Carver Chen Cho Conti Costa Dahl Das Delaney Duarte Ellis Finch Flores Fong ' +
  'Frost Gale Garcia Ghosh Giraud Hart Hayes Ho Ibarra Jensen Keller Kim Kline Kovac Lam Larsen ' +
  'Leclerc Liang Lin Lopez Marin Malik Mendez Meyer Moreau Naidu Nash Noor Novak Ortega Park Patel ' +
  'Quinn Ramos Rao Reyes Rios Rossi Rowan Salem Santos Shah Singh Stein Tan Varga Vega Zhao'
).split(' ')

export type DemoOrganization = {
  id: string
  name: string
  kind: 'Company' | OrganizationSpec['kind']
  parentId: string | null
}
export type DemoWorkspace = {
  id: string
  name: string
  organizationId: string
  relatedOrganizationIds: string[]
  parentId: string | null
  ownerId: string
}
export type DemoEmployee = {
  id: string
  name: string
  email: string
  organizationId: string
  team: string
  homeWorkspaceId: string
}
export type DemoMembership = { employeeId: string; workspaceId: string; role: DemoRole }

export function buildWorkspaceDemo(scenario: DemoScenario, layout: 'current' | 'before-consolidation' = 'current') {
  const spec = scenarios[scenario]
  const tenantId = `demo:${spec.slug}`
  const rootId = `${tenantId}:org:company`
  const domain = `${spec.slug}.test`
  const organizations: DemoOrganization[] = [
    { id: rootId, name: spec.company, kind: 'Company', parentId: null },
    ...spec.organizations.map(({ key, name, kind }) => ({ id: `${tenantId}:org:${key}`, name, kind, parentId: rootId })),
  ]
  const employees: DemoEmployee[] = []
  const memberships: DemoMembership[] = []
  const workspaces: DemoWorkspace[] = []
  const workspaceId = (key: string) => `${tenantId}:ws:${key}`
  const sharedId = spec.sharedWorkspace ? workspaceId(spec.sharedWorkspace) : null
  const nameOffset: Record<DemoScenario, number> = { enterprise: 0, smb: 4000, startup: 4500 }

  for (const workspace of spec.workspaces) {
    const id = workspaceId(workspace.key)
    const organizationId = workspace.organization ? `${tenantId}:org:${workspace.organization}` : rootId
    const ownerId = `${tenantId}:person:${employees.length + 1}`
    workspaces.push({
      id,
      name: workspace.name,
      organizationId,
      parentId: workspace.parent ? workspaceId(workspace.parent) : null,
      relatedOrganizationIds: id === sharedId ? organizations.slice(1).map((org) => org.id) : [],
      ownerId,
    })
    for (const [team, count] of workspace.teams) {
      for (let index = 0; index < count; index++) {
        const sequence = employees.length
        // A coprime step shuffles unique first/last pairs across teams and scenarios.
        const nameIndex = ((sequence + nameOffset[scenario]) * 97) % (firstNames.length * lastNames.length)
        const first = firstNames[nameIndex % firstNames.length]
        const last = lastNames[Math.floor(nameIndex / firstNames.length)]
        const employeeId = `${tenantId}:person:${sequence + 1}`
        employees.push({
          id: employeeId,
          name: `${first} ${last}`,
          email: `${first}.${last}@${domain}`.toLowerCase(),
          organizationId,
          team,
          homeWorkspaceId: id,
        })
        const role = employeeId === ownerId ? 'admin' : index % 25 === 0 ? 'editor' : index % 19 === 0 ? 'viewer' : 'member'
        memberships.push({ employeeId, workspaceId: id, role })
        if (sharedId && id !== sharedId && (scenario === 'startup' || index === 0)) {
          memberships.push({ employeeId, workspaceId: sharedId, role: 'member' })
        }
      }
    }
  }

  const data = {
    scenario,
    tenantId,
    company: spec.company,
    fixtureEmailDomain: domain,
    organizations,
    workspaces,
    employees,
    memberships,
  }
  if (layout === 'before-consolidation' || scenario === 'enterprise') return data

  // Keep the original staffing order and identifiers so seeded credentials survive the move.
  const moves: Record<string, string> = scenario === 'startup'
    ? { product: 'hub', growth: 'hub' }
    : { logistics: 'plant', quality: 'plant', office: 'hub' }
  const destination = (id: string) => {
    const target = moves[id.split(':').at(-1)!]
    return target ? workspaceId(target) : id
  }
  const originalHome = new Map(employees.map((person) => [person.id, person.homeWorkspaceId]))
  const consolidated = new Map<string, DemoMembership>()
  for (const entry of memberships) {
    const target = destination(entry.workspaceId)
    const key = `${entry.employeeId}/${target}`
    const isHome = originalHome.get(entry.employeeId) === entry.workspaceId
    if (!consolidated.has(key) || isHome) {
      consolidated.set(key, {
        ...entry,
        workspaceId: target,
        // Former workspace owners become Managers without gaining Admin over a larger roster.
        role: target !== entry.workspaceId && entry.role === 'admin' ? 'editor' : entry.role,
      })
    }
  }
  const names: Record<string, string> = scenario === 'smb'
    ? { plant: 'Operations', sales: 'Sales', hub: 'Internal' }
    : {}
  return {
    ...data,
    employees: employees.map((person) => ({ ...person, homeWorkspaceId: destination(person.homeWorkspaceId) })),
    memberships: [...consolidated.values()],
    workspaces: workspaces.filter((workspace) => destination(workspace.id) === workspace.id).map((workspace) => {
      const absorbed = workspaces.filter((original) => original.id !== workspace.id && destination(original.id) === workspace.id)
      return {
        ...workspace,
        name: names[workspace.id.split(':').at(-1)!] ?? workspace.name,
        relatedOrganizationIds: [...new Set([
          ...workspace.relatedOrganizationIds,
          ...absorbed.flatMap((original) => [original.organizationId, ...original.relatedOrganizationIds]),
        ])].filter((id) => id !== workspace.organizationId),
      }
    }),
  }
}

export type WorkspaceDemo = ReturnType<typeof buildWorkspaceDemo>
