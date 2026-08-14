import { useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { EnterpriseDeleteConfirmModal } from '@/components/enterprise/EnterpriseDeleteConfirmModal'
import { useFolderStore } from '@/modules/projects'
import { useProjectStore } from '@/modules/projects'
import { useFolderNotesStore } from '../store/folderNotesStore'
import { useToast } from '@/components/ui/toast'
import { parseApiErrorMessage } from '@/lib/api/httpClient'
import { notifyEvent } from '@/lib/api/notificationApi'
import {
  collectFolderDeletionOrder,
  resolveChildFolderCount,
} from '../lib/folderHierarchy'
import type { Folder } from '@/modules/projects'

const MAX_LISTED_FOLDER_NAMES = 6

interface DeleteFolderConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: Folder[]
  totalProjectCount: number
  onDeleted?: () => void
}

export function DeleteFolderConfirmModal({
  open,
  onOpenChange,
  folders,
  totalProjectCount,
  onDeleted,
}: DeleteFolderConfirmModalProps) {
  const { deleteFolder, folders: allFolders, fetchFolders } = useFolderStore()
  const { moveProjectsToFolder, getProjectsByFolder } = useProjectStore()
  const deleteNotesForFolders = useFolderNotesStore((state) => state.deleteNotesForFolders)
  const { addToast } = useToast()
  const [deleteOption, setDeleteOption] = useState<'move' | 'delete'>('move')
  const [deleting, setDeleting] = useState(false)

  const folderList = useMemo(() => folders.filter(Boolean), [folders])
  const isSingle = folderList.length === 1
  const single = folderList[0]
  const deletionOrder = useMemo(
    () => collectFolderDeletionOrder(folderList.map((folder) => folder.id), allFolders),
    [folderList, allFolders],
  )
  const descendantFolderCount = Math.max(deletionOrder.length - folderList.length, 0)
  const totalChildrenCount = useMemo(
    () =>
      folderList.reduce(
        (sum, folder) => sum + resolveChildFolderCount(folder, allFolders),
        0,
      ),
    [folderList, allFolders],
  )
  const totalProjectsInDeletion = useMemo(() => {
    const seen = new Set<string>()
    let count = 0
    for (const folderId of deletionOrder) {
      if (seen.has(folderId)) continue
      seen.add(folderId)
      count += getProjectsByFolder(folderId).length
    }
    return count
  }, [deletionOrder, getProjectsByFolder])

  useEffect(() => {
    if (open) setDeleteOption('move')
  }, [open, folderList.map((folder) => folder.id).join('|')])

  if (!open || folderList.length === 0) return null

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetchFolders()
      const freshFolders = useFolderStore.getState().folders
      const orderedFolderIds = collectFolderDeletionOrder(
        folderList.map((folder) => folder.id),
        freshFolders,
      )

      for (const folderId of orderedFolderIds) {
        const projectsInFolder = getProjectsByFolder(folderId)
        if (projectsInFolder.length > 0) {
          await moveProjectsToFolder(
            projectsInFolder.map((project) => project.id),
            null,
          )
        }

        await deleteFolder(folderId)
      }

      deleteNotesForFolders(orderedFolderIds)

      await fetchFolders()

      if (deleteOption === 'delete' && totalProjectsInDeletion > 0) {
        addToast({
          title: 'Warning',
          description: 'Projects were moved to root instead of deleted (delete not implemented).',
          variant: 'error',
        })
      }

      onOpenChange(false)
      onDeleted?.()

      if (isSingle && single) {
        const cascadeNote =
          descendantFolderCount > 0
            ? ` ${descendantFolderCount} subfolder${descendantFolderCount === 1 ? '' : 's'} also removed.`
            : ''
        notifyEvent({
          type_code: 'folder',
          title: 'Folder dihapus',
          body: `Folder "${single.name}" telah dihapus.${cascadeNote}`,
        })
      } else {
        notifyEvent({
          type_code: 'folder',
          title: 'Folders dihapus',
          body: `${folderList.length} folder telah dihapus${
            descendantFolderCount > 0
              ? ` (${descendantFolderCount} subfolder${descendantFolderCount === 1 ? '' : 's'} included).`
              : '.'
          }`,
        })
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to delete folder'
      const msg = parseApiErrorMessage(raw, 'Failed to delete folder')
      addToast({ title: 'Cannot delete folder', description: msg, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <EnterpriseDeleteConfirmModal
      open={open}
      onClose={() => onOpenChange(false)}
      onConfirm={handleDelete}
      busy={deleting}
      title={isSingle ? 'Delete Folder' : 'Delete Folders'}
      description={
        isSingle
          ? 'This action permanently removes the folder and cannot be undone.'
          : `This action permanently removes ${folderList.length} folders and cannot be undone.`
      }
      entityLabel={isSingle ? 'Folder' : 'Folders'}
      entityValue={
        isSingle
          ? (single?.name ?? '—')
          : `${folderList.length} selected folders`
      }
      impactSummary={
        totalProjectsInDeletion > 0 || totalChildrenCount > 0 || !isSingle ? (
          <>
            <div className="font-medium text-foreground">Impact summary</div>
            {totalProjectsInDeletion > 0 ? (
              <div className="mt-1">
                Projects in selected folders: {totalProjectsInDeletion}{' '}
                {totalProjectsInDeletion === 1 ? 'project' : 'projects'}
                {totalProjectsInDeletion !== totalProjectCount && totalProjectCount > 0
                  ? ` (including ${totalProjectsInDeletion - totalProjectCount} in subfolders)`
                  : null}
              </div>
            ) : null}
            {totalChildrenCount > 0 ? (
              <div>
                Subfolders: {totalChildrenCount}
                <span className="mt-1 block text-sm text-muted-foreground">
                  All subfolders will also be permanently deleted.
                </span>
              </div>
            ) : null}
            {!isSingle ? (
              <ol className="mt-2 list-decimal space-y-1 pl-5 marker:font-medium marker:text-muted-foreground">
                {folderList.slice(0, MAX_LISTED_FOLDER_NAMES).map((folder) => (
                  <li key={folder.id} className="pl-1 text-foreground">
                    {folder.name}
                  </li>
                ))}
                {folderList.length > MAX_LISTED_FOLDER_NAMES ? (
                  <li className="list-none pl-0 text-muted-foreground">
                    + {folderList.length - MAX_LISTED_FOLDER_NAMES} more
                  </li>
                ) : null}
              </ol>
            ) : null}
          </>
        ) : null
      }
      footerExtra={
        totalProjectsInDeletion > 0 ? (
          <RadioGroup value={deleteOption} onValueChange={(value) => setDeleteOption(value as 'move' | 'delete')}>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background/70 p-4">
              <RadioGroupItem value="move" id="delete-folder-move" className="mt-0.5" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="delete-folder-move" className="cursor-pointer text-sm font-medium text-foreground">
                  Move projects to All Projects
                </Label>
                <p className="text-xs text-muted-foreground">
                  Projects will be moved to the root level before the selected folders are removed.
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-start gap-3 rounded-xl border border-destructive/30 bg-background/70 p-4">
              <RadioGroupItem value="delete" id="delete-folder-delete-projects" className="mt-0.5" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="delete-folder-delete-projects"
                  className="cursor-pointer text-sm font-medium text-destructive"
                >
                  Delete projects too
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permanently delete all projects in the selected folders before removing the folders.
                </p>
              </div>
            </div>
          </RadioGroup>
        ) : null
      }
      enterpriseNote={
        totalChildrenCount > 0
          ? 'All subfolders and their contents will be permanently removed along with the selected folder(s).'
          : totalProjectsInDeletion > 0
            ? 'Choose how projects in the selected folders should be handled before the folders are removed.'
            : 'Enterprise note: folder structure changes apply immediately across the project workspace.'
      }
      confirmLabel={isSingle ? 'Delete folder' : `Delete ${folderList.length} folders`}
      confirmBusyLabel="Deleting..."
      dialogTitleId="delete-folder-dialog-title"
    />
  )
}
