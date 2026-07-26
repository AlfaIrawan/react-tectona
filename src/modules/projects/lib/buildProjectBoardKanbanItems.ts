import type { DirectoryKanbanItem } from '@/modules/task-work-management/components/DirectoryKanbanView'
import type { ProjectTemplate } from '../data/projectTemplates'
import type { Project } from '../store/projectStore'
import { TECTONA_PROJECT_WORKSPACE } from '@/lib/api/workApi'
import { KANBAN_TEMPLATE_BLUEPRINTS } from './kanbanUiUxTemplateBlueprints'

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

/** Offline fallback — mirrors Postgres template seed (migration 008, Banking System use case). */
export function buildProjectBoardKanbanItems(
  project: Project,
  options?: { ownerName?: string; template?: ProjectTemplate },
): DirectoryKanbanItem[] {
  const anchor = resolveAnchorDate(project)
  const workspace = TECTONA_PROJECT_WORKSPACE
  const assignee = options?.ownerName?.trim() || 'Unassigned'
  const label = 'Banking System'

  return KANBAN_TEMPLATE_BLUEPRINTS.map((entry) => ({
    id: `${project.id}-board-${entry.suffix}`,
    title: entry.title,
    type: entry.type,
    status: entry.status,
    priority: entry.priority,
    assignee,
    workspace,
    project: project.name,
    label,
    dueDate: addDaysFromIso(anchor, entry.dueOffset),
    progress: entry.progress,
  }))
}
