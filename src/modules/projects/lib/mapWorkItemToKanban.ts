import type { WorkItemApiModel, WorkStatus } from '@/lib/api/workApi'
import type { DirectoryKanbanItem } from '@/modules/task-work-management/components/DirectoryKanbanView'

export function mapWorkItemToKanban(item: WorkItemApiModel): DirectoryKanbanItem {
  const status =
    (item.status as string) === 'Blocked' ? ('Backlog' as WorkStatus) : item.status

  return {
    id: item.id,
    title: item.title,
    type: item.type,
    status,
    priority: item.priority,
    assignee: item.assignee,
    workspace: item.workspace,
    project: item.project,
    label: item.label ?? undefined,
    dueDate: item.dueDate,
    progress: item.progress ?? 0,
    syncOrigin: item.syncOrigin ?? undefined,
    externalLinks: item.externalLinks?.map((link) => ({ provider: link.provider })),
  }
}
