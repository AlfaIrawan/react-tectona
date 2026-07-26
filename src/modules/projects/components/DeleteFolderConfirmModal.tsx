import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useFolderStore } from '@/modules/projects'
import { useProjectStore } from '@/modules/projects'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import type { Folder } from '@/modules/projects'

interface DeleteFolderConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: Folder | null
  projectCount: number
}

export function DeleteFolderConfirmModal({
  open,
  onOpenChange,
  folder,
  projectCount,
}: DeleteFolderConfirmModalProps) {
  const { deleteFolder } = useFolderStore()
  const { moveProjectsToFolder, getProjectsByFolder } = useProjectStore()
  const { addToast } = useToast()
  const [deleteOption, setDeleteOption] = useState<'move' | 'delete'>('move')
  const [deleting, setDeleting] = useState(false)

  if (!folder) return null

  const handleDelete = async () => {
    setDeleting(true)
    try {
      if (deleteOption === 'move') {
        // Move all projects to root (folderId = null)
        const projectsInFolder = getProjectsByFolder(folder.id)
        if (projectsInFolder.length > 0) {
          await moveProjectsToFolder(
            projectsInFolder.map((p) => p.id),
            null
          )
        }
      } else {
        // Delete projects too - in real app, this would call deleteProject API
        // For now, we'll just move them to root as a safety measure
        // In production, you would call: deleteProject for each project
        const projectsInFolder = getProjectsByFolder(folder.id)
        if (projectsInFolder.length > 0) {
          // TODO: Implement actual project deletion API call
          // For now, move to root as safety
          await moveProjectsToFolder(
            projectsInFolder.map((p) => p.id),
            null
          )
          addToast({
            title: 'Warning',
            description: 'Projects were moved to root instead of deleted (delete not implemented).',
            variant: 'error',
          })
        }
      }

      await deleteFolder(folder.id)
      onOpenChange(false)
      addToast({
        title: 'Folder dihapus',
        description: `Folder "${folder.name}" telah dihapus.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder dihapus',
        body: `Folder "${folder.name}" telah dihapus.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete folder'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete Folder
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{folder.name}"?
            {projectCount > 0 && (
              <span className="block mt-1">
                This folder contains {projectCount} {projectCount === 1 ? 'project' : 'projects'}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {projectCount > 0 && (
          <div className="space-y-4">
            <RadioGroup value={deleteOption} onValueChange={(value) => setDeleteOption(value as 'move' | 'delete')}>
              <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="move" id="move" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="move" className="cursor-pointer">
                    Move projects to All Projects
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Projects will be moved to the root level (default)
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2 space-y-0 rounded-md border border-destructive/50 p-4">
                <RadioGroupItem value="delete" id="delete" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="delete" className="cursor-pointer text-destructive">
                    Delete projects too
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    This will permanently delete all projects in this folder
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Folder'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
