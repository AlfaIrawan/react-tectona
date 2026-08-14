import type { WorkItemApiModel } from '@/lib/api/workApi'
import { EnterpriseDeleteConfirmModal } from '@/components/enterprise/EnterpriseDeleteConfirmModal'
import { resolveWorkItemSchedule } from '../lib/buildProjectCalendarEvents'

export function CalendarTaskDeleteConfirmModal({
  open,
  workItem,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  workItem: Pick<WorkItemApiModel, 'id' | 'title' | 'type' | 'status' | 'assignee' | 'startDate' | 'dueDate'> | null
  busy?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const schedule = workItem ? resolveWorkItemSchedule(workItem as WorkItemApiModel) : null

  return (
    <EnterpriseDeleteConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={busy}
      title="Delete Task"
      description="This permanently removes the task from the project calendar and work directory. This action cannot be undone."
      entityLabel="Task"
      entityValue={workItem?.title ?? '—'}
      impactSummary={
        workItem ? (
          <>
            <div className="font-medium text-foreground">Impact summary</div>
            <div className="mt-1">ID: {workItem.id}</div>
            <div>Type: {workItem.type}</div>
            <div>Status: {workItem.status}</div>
            <div>Assignee: {workItem.assignee || 'Unassigned'}</div>
            {schedule ? (
              <div>
                Schedule: {schedule.startDate} → {schedule.dueDate}
              </div>
            ) : null}
          </>
        ) : null
      }
      enterpriseNote="Enterprise note: calendar day order and linked schedule views will update after deletion."
      confirmLabel="Delete task"
      confirmBusyLabel="Deleting..."
      dialogTitleId="calendar-delete-task-dialog-title"
    />
  )
}
