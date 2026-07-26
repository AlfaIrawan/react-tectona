import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFolderStore } from '@/modules/projects'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import type { Folder } from '@/modules/projects'

interface RenameFolderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: Folder | null
}

export function RenameFolderModal({ open, onOpenChange, folder }: RenameFolderModalProps) {
  const { updateFolder, isFolderNameUnique } = useFolderStore()
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (folder) {
      setName(folder.name)
      setError(null)
    }
  }, [folder])

  useEffect(() => {
    if (open && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus()
        nameInputRef.current?.select()
      }, 100)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folder) return

    const nameTrimmed = name.trim()
    if (!nameTrimmed) {
      setError('Folder name is required')
      nameInputRef.current?.focus()
      return
    }

    if (nameTrimmed.length < 3) {
      setError('Folder name must be at least 3 characters')
      nameInputRef.current?.focus()
      return
    }

    if (nameTrimmed.length > 40) {
      setError('Folder name must be at most 40 characters')
      nameInputRef.current?.focus()
      return
    }

    if (!isFolderNameUnique(nameTrimmed, folder.id, folder.parentId)) {
      setError('Folder name already exists')
      nameInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      await updateFolder(folder.id, { name: nameTrimmed })
      onOpenChange(false)
      addToast({
        title: 'Folder diubah',
        description: `Folder telah diubah menjadi "${nameTrimmed}".`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder diubah',
        body: `Folder telah diubah menjadi "${nameTrimmed}".`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to rename folder'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!folder) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Folder Name <span className="text-destructive">*</span>
            </Label>
            <Input
              ref={nameInputRef}
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Enter folder name"
              className={error ? 'border-destructive' : ''}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
