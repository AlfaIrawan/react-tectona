import { EnterpriseDeleteConfirmModal } from '@/components/enterprise/EnterpriseDeleteConfirmModal'
import { useFolderStore } from '@/modules/projects'
import type { Project } from '@/modules/projects'

const MAX_LISTED_NAMES = 6

interface DeleteProjectsConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  busy?: boolean
  projects: Project[]
}

export function DeleteProjectsConfirmModal({
  open,
  onClose,
  onConfirm,
  busy = false,
  projects,
}: DeleteProjectsConfirmModalProps) {
  const count = projects.length
  const isSingle = count === 1
  const single = projects[0]
  const { getFolder } = useFolderStore()
  const folderLabel =
    isSingle && single
      ? single.folderId
        ? getFolder(single.folderId)?.name ?? 'Assigned folder'
        : 'All Projects (root)'
      : null

  return (
    <EnterpriseDeleteConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={busy}
      title={isSingle ? 'Delete Project' : 'Delete Projects'}
      description={
        isSingle
          ? 'This action permanently removes the project and cannot be undone.'
          : `This action permanently removes ${count} archived projects and cannot be undone.`
      }
      entityLabel={isSingle ? 'Project' : 'Projects'}
      entityValue={isSingle ? (single?.name ?? '—') : `${count} archived projects`}
      impactSummary={
        count > 0 ? (
          <>
            <div className="font-medium text-foreground">Impact summary</div>
            {isSingle ? (
              <>
                <div className="mt-1">Status: Archived</div>
                <div>Location: {folderLabel}</div>
                <div>Members: {single?.members?.length ?? 0}</div>
                {(single?.tags?.length ?? 0) > 0 && (
                  <div>Tags: {single?.tags?.length ?? 0}</div>
                )}
              </>
            ) : (
              <>
                <div className="mt-1">Projects to delete: {count}</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5 marker:font-medium marker:text-muted-foreground">
                  {projects.slice(0, MAX_LISTED_NAMES).map((p) => (
                    <li key={p.id} className="pl-1 text-foreground">
                      {p.name}
                    </li>
                  ))}
                  {count > MAX_LISTED_NAMES && (
                    <li className="list-none pl-0 text-muted-foreground">
                      + {count - MAX_LISTED_NAMES} more
                    </li>
                  )}
                </ol>
              </>
            )}
          </>
        ) : null
      }
      enterpriseNote="Enterprise note: linked tasks, documents, and todos may require separate cleanup in downstream services."
      confirmLabel={isSingle ? 'Delete project' : `Delete ${count} projects`}
      confirmBusyLabel="Deleting..."
      dialogTitleId="delete-projects-dialog-title"
    />
  )
}
