import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useFolderStore } from '@/modules/projects'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import { cn } from '@/lib/utils'

interface CreateFolderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateFolderModal({ open, onOpenChange }: CreateFolderModalProps) {
  const { addFolder, isFolderNameUnique } = useFolderStore()
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isShared: false,
  })
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setFormData({ name: '', description: '', isShared: false })
      setErrors({})
      setSubmitting(false)
    }
  }, [open])

  // ESC key to close
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [open, onOpenChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const nameTrimmed = formData.name.trim()
    if (!nameTrimmed) {
      setErrors({ name: 'Folder name is required' })
      nameInputRef.current?.focus()
      return
    }

    if (nameTrimmed.length < 3) {
      setErrors({ name: 'Folder name must be at least 3 characters' })
      nameInputRef.current?.focus()
      return
    }

    if (nameTrimmed.length > 40) {
      setErrors({ name: 'Folder name must be at most 40 characters' })
      nameInputRef.current?.focus()
      return
    }

    if (!isFolderNameUnique(nameTrimmed, undefined, null)) {
      setErrors({ name: 'Folder name already exists' })
      nameInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      await addFolder({
        name: nameTrimmed,
        description: formData.description.trim() || undefined,
        parentId: null, // Root folder for now
        ownerId: '00000000-0000-0000-0000-000000000001', // Dummy owner
      })

      onOpenChange(false)
      addToast({
        title: 'Folder berhasil dibuat',
        description: `Folder "${nameTrimmed}" telah dibuat.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder berhasil dibuat',
        body: `Folder "${nameTrimmed}" telah dibuat.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Overlay backdrop - covers entire screen including topbar */}
      <div
        className={cn(
          'fixed top-0 left-0 right-0 bottom-0 bg-black/20 backdrop-blur-sm z-[1050] transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        style={{
          margin: 0,
          padding: 0,
          width: '100vw',
          height: '100vh',
          top: 0,
          left: 0,
        }}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
        role="button"
        tabIndex={-1}
      />

      {/* Slide-out panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-screen w-[480px] transform z-[1100] transition-all duration-300',
          'backdrop-blur-xl bg-background/95 border-l border-border shadow-2xl',
          open ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        )}
        style={{
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
          margin: 0,
          padding: 0,
        }}
        data-create-folder-open={open}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Create New Folder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Folder untuk mengelompokkan project.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close create folder"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-[calc(100%-5rem)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Folder Name <span className="text-destructive">*</span>
              </Label>
              <Input
                ref={nameInputRef}
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  if (errors.name) setErrors({})
                }}
                placeholder="Enter folder name"
                className={errors.name ? 'border-destructive' : ''}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional folder description"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isShared">Share folder</Label>
              <Switch
                id="isShared"
                checked={formData.isShared}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isShared: checked })
                }
              />
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
                {submitting ? 'Creating...' : 'Create Folder'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
