import type { WorkItemApiModel } from '@/lib/api/workApi'
import type { WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'

/** Legacy dev-seed / integration fallbacks — not real Tectona directory workspaces. */
export const LEGACY_DEMO_WORKSPACE_NAMES = new Set([
  'Execution Workspace',
  'PMO Central',
  'Reporting Workspace',
])

/** Gantt bucket for work items whose workspace slug/name is not in Workspace Org or Monday picker. */
export const UNIDENTIFIED_WORKSPACE_LABEL = 'Unidentified'

export type WorkspacePickerGroups = {
  tectona: string[]
  monday: string[]
}

export function isMondaySourcedWorkItem(
  item: Pick<WorkItemApiModel, 'syncOrigin' | 'externalLinks'>,
): boolean {
  if (item.syncOrigin === 'monday') return true
  return (item.externalLinks ?? []).some((link) => link.provider === 'monday')
}

/** Same grouping as Task & Work Management workspace picker (Tectona vs Monday). */
export function buildWorkspacePickerGroups(
  tectonaWorkspaces: Array<Pick<WorkspaceOrgWorkspaceDto, 'name'>>,
  workItems: Array<Pick<WorkItemApiModel, 'workspace' | 'syncOrigin' | 'externalLinks'>>,
): WorkspacePickerGroups {
  const tectona = tectonaWorkspaces
    .map((ws) => ws.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  const tectonaSet = new Set(tectona)
  const monday = Array.from(
    new Set(
      workItems
        .filter(isMondaySourcedWorkItem)
        .map((item) => item.workspace?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  )
    .filter((name) => !tectonaSet.has(name) && !LEGACY_DEMO_WORKSPACE_NAMES.has(name))
    .sort((a, b) => a.localeCompare(b))
  return { tectona, monday }
}

export function allWorkspacePickerNames(groups: WorkspacePickerGroups): string[] {
  return [...groups.tectona, ...groups.monday]
}

export function defaultTectonaWorkspaceName(groups: WorkspacePickerGroups): string {
  return groups.tectona[0] ?? groups.monday[0] ?? ''
}

/** Resolve workspace slug or display name → canonical label from Workspace Org. */
export function buildWorkspaceLabelLookup(
  workspaces: Array<Pick<WorkspaceOrgWorkspaceDto, 'workspace_key' | 'name'>>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const ws of workspaces) {
    const key = ws.workspace_key.trim()
    const name = ws.name.trim()
    if (key) map.set(key, name || key)
    if (name) map.set(name, name)
  }
  return map
}

/**
 * Resolve a work item to a workspace label for Gantt / timeline.
 * Known Tectona or Monday workspaces keep their picker name; everything else → Unidentified.
 */
export function resolveWorkItemWorkspaceLabel(
  item: Pick<WorkItemApiModel, 'workspace' | 'syncOrigin' | 'externalLinks'>,
  labelLookup: Map<string, string>,
  groups: WorkspacePickerGroups,
): string {
  const raw = item.workspace?.trim()
  if (!raw || LEGACY_DEMO_WORKSPACE_NAMES.has(raw)) {
    return UNIDENTIFIED_WORKSPACE_LABEL
  }

  const allowed = new Set(allWorkspacePickerNames(groups))
  const fromLookup = labelLookup.get(raw)
  if (fromLookup && allowed.has(fromLookup)) return fromLookup
  if (allowed.has(raw)) return raw

  return UNIDENTIFIED_WORKSPACE_LABEL
}
