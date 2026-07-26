import type { WorkItemApiModel, WorkStatus } from '@/lib/api/workApi'
import { TECTONA_PROJECT_WORKSPACE } from '@/lib/api/workApi'
import { KANBAN_TEMPLATE_BLUEPRINTS } from './kanbanUiUxTemplateBlueprints'
import type { Project } from '../store/projectStore'

const TEMPLATE_PARENT_BY_SUFFIX: Record<string, string | null> = {
  'epic-banking-delivery': null,
  'feat-vendor-selection': 'epic-banking-delivery',
  'feat-kickoff': 'epic-banking-delivery',
  'feat-dev-sprint-zero': 'epic-banking-delivery',
  'task-charter': 'epic-banking-delivery',
  'task-business-case': 'epic-banking-delivery',
  'task-rfp-published': 'feat-vendor-selection',
  'task-vendor-evaluation': 'feat-vendor-selection',
  'task-compliance-assessment': 'feat-vendor-selection',
  'task-vendor-contract': 'feat-vendor-selection',
  'task-sla-draft': 'feat-vendor-selection',
  'bug-vendor-api-gap': 'feat-vendor-selection',
  'task-architecture-signoff': 'feat-kickoff',
  'task-kickoff-prep': 'feat-kickoff',
  'task-squad-raci': 'feat-kickoff',
  'task-dev-env': 'feat-kickoff',
  'task-stakeholder-kickoff': 'feat-kickoff',
  'task-integration-blueprint': 'feat-dev-sprint-zero',
  'task-core-ledger': 'feat-dev-sprint-zero',
  'task-payment-hub': 'feat-dev-sprint-zero',
  'task-swift-sepa': 'feat-dev-sprint-zero',
  'task-mobile-banking': 'feat-dev-sprint-zero',
  'task-reg-reporting': 'feat-dev-sprint-zero',
  'task-data-migration': 'feat-dev-sprint-zero',
}

function addDaysFromIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function resolveAnchorDate(project: Project): string {
  const fromCreated = project.createdAt?.slice(0, 10)
  if (fromCreated && /^\d{4}-\d{2}-\d{2}$/.test(fromCreated)) return fromCreated
  return new Date().toISOString().slice(0, 10)
}

export function projectWorkItemBusinessKeyPrefix(projectId: string): string {
  return `PT-${projectId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export function filterWorkItemsForProject(
  items: WorkItemApiModel[],
  projectId: string,
): WorkItemApiModel[] {
  const prefix = projectWorkItemBusinessKeyPrefix(projectId)
  return items.filter((item) => item.id.startsWith(`${prefix}-`))
}

export function normalizeWorkStatus(status: string): WorkStatus {
  if (status === 'Blocked') return 'Backlog'
  return status as WorkStatus
}

/** Offline mirror of Postgres template seed (migration 008, Banking System). */
export function buildFallbackWorkItems(
  project: Project,
  options?: { ownerName?: string },
): WorkItemApiModel[] {
  const anchor = resolveAnchorDate(project)
  const assignee = options?.ownerName?.trim() || 'Unassigned'
  const prefix = projectWorkItemBusinessKeyPrefix(project.id)
  const nowIso = new Date().toISOString()

  const keyBySuffix = new Map<string, string>()
  for (const entry of KANBAN_TEMPLATE_BLUEPRINTS) {
    keyBySuffix.set(entry.suffix, `${prefix}-${entry.suffix}`)
  }

  return KANBAN_TEMPLATE_BLUEPRINTS.map((entry) => {
    const businessKey = keyBySuffix.get(entry.suffix)!
    const parentSuffix = TEMPLATE_PARENT_BY_SUFFIX[entry.suffix]
    const parentKey = parentSuffix ? keyBySuffix.get(parentSuffix) ?? null : null

    return {
      id: businessKey,
      title: entry.title,
      type: entry.type as WorkItemApiModel['type'],
      project: project.name,
      workspace: TECTONA_PROJECT_WORKSPACE,
      label: 'Banking System',
      assignee,
      owner: assignee,
      role: 'Contributor',
      team: 'Delivery Squad',
      priority: entry.priority,
      status: entry.status,
      dueDate: addDaysFromIso(anchor, entry.dueOffset),
      dependencyStatus: 'Clear',
      progress: entry.progress,
      estimatedHours: 0,
      actualHours: 0,
      lastUpdated: nowIso,
      parentId: parentKey,
      epicId: entry.suffix === 'epic-banking-delivery' ? businessKey : keyBySuffix.get('epic-banking-delivery') ?? null,
      featureId:
        entry.type === 'Feature'
          ? businessKey
          : parentSuffix?.startsWith('feat-')
            ? keyBySuffix.get(parentSuffix) ?? null
            : null,
      description: '',
    }
  })
}
