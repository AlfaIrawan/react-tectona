import { workspaceClassificationRank } from '@/lib/workspacePersonalOrgScope'

export type OperationalReparentCandidate = {
  id: string
  type: string
  isPersonalWorkspace: boolean
  primaryOrganizationId: string
  parentWorkspaceId: string | null
  name: string
  status?: string
}

export type OperationalReparentTarget = {
  id: string | null
  name: string
  type: string
}

export function canReparentOperationalWorkspace(workspace: {
  isPersonalWorkspace: boolean
  type: string
}): boolean {
  if (workspace.isPersonalWorkspace) return false
  return workspace.type.trim() !== 'Organization'
}

export function collectWorkspaceDescendantIds(
  rootId: string,
  catalog: ReadonlyArray<{ id: string; parentWorkspaceId: string | null }>,
): Set<string> {
  const children = new Map<string, string[]>()
  for (const row of catalog) {
    const parentId = row.parentWorkspaceId?.trim()
    if (!parentId) continue
    const list = children.get(parentId) ?? []
    list.push(row.id)
    children.set(parentId, list)
  }
  const out = new Set<string>()
  const queue = [...(children.get(rootId) ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (out.has(id)) continue
    out.add(id)
    queue.push(...(children.get(id) ?? []))
  }
  return out
}

export function listOperationalDirectoryReparentTargets(
  child: OperationalReparentCandidate,
  catalog: ReadonlyArray<OperationalReparentCandidate>,
): OperationalReparentTarget[] {
  if (!canReparentOperationalWorkspace(child)) return []

  const descendants = collectWorkspaceDescendantIds(child.id, catalog)
  const childRank = workspaceClassificationRank(child.type, child.isPersonalWorkspace)
  const orgHome = catalog.find(
    (row) =>
      row.primaryOrganizationId === child.primaryOrganizationId
      && row.type === 'Organization'
      && !row.isPersonalWorkspace
      && !row.parentWorkspaceId,
  )

  const targets: OperationalReparentTarget[] = []
  if (orgHome && orgHome.id !== child.id) {
    targets.push({ id: orgHome.id, name: `${orgHome.name} (organization home)`, type: orgHome.type })
  }

  for (const row of catalog) {
    if (row.id === child.id) continue
    if (row.primaryOrganizationId !== child.primaryOrganizationId) continue
    if (row.isPersonalWorkspace || row.type === 'Personal') continue
    if (row.status === 'Archived') continue
    if (descendants.has(row.id)) continue
    if (orgHome && row.id === orgHome.id) continue
    const parentRank = workspaceClassificationRank(row.type, row.isPersonalWorkspace)
    if (parentRank >= childRank) continue
    targets.push({ id: row.id, name: `${row.name} (${row.type})`, type: row.type })
  }

  return targets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
