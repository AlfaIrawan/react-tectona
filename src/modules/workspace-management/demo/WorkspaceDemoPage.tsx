import { useMemo, useState, type ReactNode } from 'react'
import { BarChart3, Building2, Database, RotateCcw, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buildWorkspaceDemo, demoRoles, demoScenarios, type DemoScenario, type WorkspaceDemo } from './workspaceDemoFixtures'

const panels = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'directory', label: 'Workspace Directory', icon: Building2 },
  { id: 'members', label: 'Workspace Members', icon: Users },
] as const
type Panel = typeof panels[number]['id']
const scenarioLabels: Record<DemoScenario, string> = { enterprise: 'Enterprise', smb: 'SMB', startup: 'Startup' }
const numbers = new Intl.NumberFormat('en-US')
const pageSize = 25
const selectClass = 'mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const headingClass = 'text-lg font-semibold'
const cellClass = 'px-4 py-3 text-left align-top'

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function DemoTable({ label, columns, children }: { label: string; columns: string[]; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <table className="w-full text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="border-b bg-muted">
          <tr>
            {columns.map((column) => <th key={column} scope="col" className={cellClass}>{column}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  )
}

function Overview({ data }: { data: WorkspaceDemo }) {
  const subsidiaries = data.organizations.filter((org) => org.kind === 'Subsidiary').length
  const departments = data.organizations.filter((org) => org.kind === 'Department').length
  const metrics = [
    { label: 'Employees', value: data.employees.length },
    { label: 'Workspaces', value: data.workspaces.length },
    ...(subsidiaries ? [{ label: 'Subsidiaries', value: subsidiaries }] : []),
    ...(departments ? [{ label: 'Departments', value: departments }] : []),
  ]
  const employeeCounts = new Map<string, number>()
  for (const employee of data.employees) {
    employeeCounts.set(employee.organizationId, (employeeCounts.get(employee.organizationId) ?? 0) + 1)
  }

  return (
    <section aria-labelledby="demo-overview" className="space-y-4">
      <h2 id="demo-overview" className={headingClass}>Overview</h2>
      <dl className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-3">
        {metrics.map(({ label, value }) => (
          <Card key={label} className="rounded-xl p-4">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{numbers.format(value)}</dd>
          </Card>
        ))}
      </dl>
      <Card className="rounded-xl p-4">
        <h3 className="font-semibold">Organization structure</h3>
        <p className="mt-1 text-sm text-muted-foreground">Headcount by each employee’s home organization.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {data.organizations.map((org) => (
            <li key={org.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', org.parentId && 'ml-4 border-l pl-3')}>
              <span className="font-medium">{org.name}</span>
              <span className="text-muted-foreground">{org.kind} · {numbers.format(employeeCounts.get(org.id) ?? 0)} employees</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="rounded-xl p-4">
        <h3 className="font-semibold">Test account access</h3>
        <p className="mt-1 text-sm">
          The Tectona workspace sandbox provides employee accounts for Ilex Identity Lite sign-in. This preview contains sample employee records only.
        </p>
      </Card>
    </section>
  )
}

function Directory({ data }: { data: WorkspaceDemo }) {
  const [query, setQuery] = useState('')
  const [organization, setOrganization] = useState('')
  const organizationById = new Map(data.organizations.map((org) => [org.id, org.name]))
  const workspaceById = new Map(data.workspaces.map((workspace) => [workspace.id, workspace.name]))
  const ownerById = new Map(data.employees.map((employee) => [employee.id, employee.name]))
  const memberCounts = new Map<string, number>()
  for (const membership of data.memberships) {
    memberCounts.set(membership.workspaceId, (memberCounts.get(membership.workspaceId) ?? 0) + 1)
  }
  const rows = data.workspaces.filter((workspace) =>
    (!organization || workspace.organizationId === organization) &&
    [workspace.name, organizationById.get(workspace.organizationId), ownerById.get(workspace.ownerId)]
      .some((value) => value?.toLowerCase().includes(query.trim().toLowerCase())),
  )
  const showHierarchy = data.scenario === 'enterprise'
  const columns = ['Workspace', 'Organization', ...(showHierarchy ? ['Parent workspace'] : []), 'Owner', 'Members']

  return (
    <section aria-labelledby="demo-directory" className="space-y-4">
      <h2 id="demo-directory" className={headingClass}>Workspace Directory</h2>
      <div className="grid gap-3 min-[600px]:grid-cols-2">
        <Field id="demo-workspace-search" label="Search workspaces">
          <Input id="demo-workspace-search" className="mt-1 h-9 text-sm" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </Field>
        {data.organizations.length > 1 && (
          <Field id="demo-organization-filter" label="Primary organization">
            <select id="demo-organization-filter" className={selectClass} value={organization} onChange={(event) => setOrganization(event.target.value)}>
              <option value="">All organizations</option>
              {data.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <p role="status" className="text-sm text-muted-foreground">{rows.length} of {data.workspaces.length} workspaces</p>
      <DemoTable label="Workspace directory results" columns={columns}>
        {rows.map((workspace) => (
          <tr key={workspace.id}>
            <th scope="row" className={cn(cellClass, 'font-medium')}>
              {workspace.name}
              {workspace.relatedOrganizationIds.length > 0 && (
                <span className="block font-normal text-muted-foreground">
                  Shared with {workspace.relatedOrganizationIds.map((id) => organizationById.get(id)).join(', ')}
                </span>
              )}
            </th>
            <td className={cellClass}>{organizationById.get(workspace.organizationId)}</td>
            {showHierarchy && <td className={cellClass}>{workspace.parentId ? workspaceById.get(workspace.parentId) : '—'}</td>}
            <td className={cellClass}>{ownerById.get(workspace.ownerId)}</td>
            <td className={cellClass}>{numbers.format(memberCounts.get(workspace.id) ?? 0)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={columns.length} className={cellClass}>No workspaces match your filters.</td></tr>}
      </DemoTable>
    </section>
  )
}

function Members({ data }: { data: WorkspaceDemo }) {
  const [query, setQuery] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const { organizationById, workspaceById, membershipsByEmployee } = useMemo(() => {
    const membershipsByEmployee = new Map<string, WorkspaceDemo['memberships']>()
    for (const membership of data.memberships) {
      const rows = membershipsByEmployee.get(membership.employeeId) ?? []
      rows.push(membership)
      membershipsByEmployee.set(membership.employeeId, rows)
    }
    return {
      membershipsByEmployee,
      organizationById: new Map(data.organizations.map((org) => [org.id, org.name])),
      workspaceById: new Map(data.workspaces.map((workspace) => [workspace.id, workspace.name])),
    }
  }, [data])

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase()
    return data.employees.flatMap((employee) => {
      if (![employee.name, employee.email, employee.team, organizationById.get(employee.organizationId)]
        .some((value) => value?.toLowerCase().includes(search))) return []
      const memberships = (membershipsByEmployee.get(employee.id) ?? []).filter((membership) =>
        (!workspace || membership.workspaceId === workspace) && (!role || membership.role === role),
      )
      return memberships.length > 0 ? [{ employee, memberships }] : []
    })
  }, [data.employees, membershipsByEmployee, organizationById, query, role, workspace])

  const start = (page - 1) * pageSize
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const compact = data.scenario === 'startup'
  const columns = ['Employee', ...(compact ? [] : ['Organization']), 'Team', 'Workspace and role']

  return (
    <section aria-labelledby="demo-members" className="space-y-4">
      <h2 id="demo-members" className={headingClass}>Workspace Members</h2>
      <div className="grid gap-3 min-[640px]:grid-cols-3">
        <Field id="demo-member-search" label="Search employees">
          <Input id="demo-member-search" className="mt-1 h-9 text-sm" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
        </Field>
        <Field id="demo-workspace-filter" label="Workspace">
          <select id="demo-workspace-filter" className={selectClass} value={workspace} onChange={(event) => { setWorkspace(event.target.value); setPage(1) }}>
            <option value="">All workspaces</option>
            {data.workspaces.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </Field>
        <Field id="demo-role-filter" label="Role">
          <select id="demo-role-filter" className={selectClass} value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }}>
            <option value="">All roles</option>
            {Object.entries(demoRoles).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm tabular-nums text-muted-foreground">
          {rows.length === 0
            ? `0 of ${numbers.format(data.employees.length)} employees`
            : `${numbers.format(start + 1)}–${numbers.format(Math.min(start + pageSize, rows.length))} of ${numbers.format(rows.length)} employees · Page ${page} of ${pages}`}
        </p>
        <nav aria-label="Employee pagination" className="flex gap-2">
          <Button variant="outline" className="h-9 px-3" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" className="h-9 px-3" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      </div>
      <DemoTable label="Workspace member results" columns={columns}>
        {rows.slice(start, start + pageSize).map(({ employee, memberships }) => (
          <tr key={employee.id}>
            <th scope="row" className={cn(cellClass, 'font-medium')}>
              {employee.name}
              <span className="block font-normal text-muted-foreground">{employee.email}</span>
            </th>
            {!compact && <td className={cellClass}>{organizationById.get(employee.organizationId)}</td>}
            <td className={cellClass}>{employee.team}</td>
            <td className={cellClass}>
              <ul className="space-y-1">
                {memberships.map((membership) => (
                  <li key={membership.workspaceId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {workspaceById.get(membership.workspaceId)} <Badge variant="secondary">{demoRoles[membership.role]}</Badge>
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={columns.length} className={cellClass}>No employees match your filters.</td></tr>}
      </DemoTable>
    </section>
  )
}

export function WorkspaceDemoPage() {
  const [scenario, setScenario] = useState<DemoScenario>('enterprise')
  const [panel, setPanel] = useState<Panel>('overview')
  const data = useMemo(() => buildWorkspaceDemo(scenario), [scenario])

  return (
    <main className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 min-[640px]:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title="Workspace Management" description="Tectona · Local scenario preview" />
          <Badge variant="outline" className="gap-1.5 bg-background">
            <Database aria-hidden="true" className="h-3.5 w-3.5" /> Read-only fixture
          </Badge>
        </div>
        <Card className="flex flex-wrap items-end gap-3 rounded-xl p-4">
          <Field id="demo-scenario" label="Demo scenario">
            <select id="demo-scenario" className={selectClass} value={scenario} onChange={(event) => {
              const selection = demoScenarios.find((candidate) => candidate === event.target.value)
              if (selection) setScenario(selection)
            }}>
              {demoScenarios.map((candidate) => <option key={candidate} value={candidate}>{scenarioLabels[candidate]}</option>)}
            </select>
          </Field>
          <Button variant="outline" className="h-9 gap-2 px-3" onClick={() => setPanel('overview')}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" /> Reset demo view
          </Button>
        </Card>
        <div className={cn('grid gap-4', scenario === 'enterprise' && 'min-[1024px]:grid-cols-[220px_minmax(0,1fr)]')}>
          <Card className="self-start rounded-xl p-3">
            <p className="px-2 pb-2 text-sm font-semibold">{data.company}</p>
            <nav aria-label="Workspace navigation" className={cn('flex flex-wrap gap-1', scenario === 'enterprise' && 'min-[1024px]:flex-col')}>
              {panels.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  className="h-9 justify-start gap-2 px-2 text-sm"
                  variant={id === panel ? 'secondary' : 'ghost'}
                  aria-current={id === panel ? 'page' : undefined}
                  onClick={() => setPanel(id)}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" /> {label}
                </Button>
              ))}
            </nav>
          </Card>
          <Card key={scenario} className="min-w-0 rounded-xl p-4 min-[640px]:p-5">
            {panel === 'overview' && <Overview data={data} />}
            {panel === 'directory' && <Directory data={data} />}
            {panel === 'members' && <Members data={data} />}
          </Card>
        </div>
      </div>
    </main>
  )
}
