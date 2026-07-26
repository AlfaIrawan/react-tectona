import { useState, useEffect } from 'react'
import { Copy, Check, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

interface ShareFolderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: Folder | null
}

export function ShareFolderModal({ open, onOpenChange, folder }: ShareFolderModalProps) {
  const { updateFolder } = useFolderStore()
  const { addToast } = useToast()
  const [isShared, setIsShared] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (folder) {
      setIsShared(!!folder.isShared)
    }
  }, [folder])

  const handleToggleShare = () => {
    if (!folder) return
    const newShared = !isShared
    setIsShared(newShared)
    updateFolder(folder.id, { isShared: newShared })
    addToast({
      title: newShared ? 'Folder dibagikan' : 'Folder dibuat private',
      description: `Folder "${folder.name}" ${newShared ? 'sekarang dibagikan' : 'sekarang private'}.`,
      variant: 'success',
    })
    notifyEvent({
      type_code: 'folder',
      title: newShared ? 'Folder dibagikan' : 'Folder dibuat private',
      body: `Folder "${folder.name}" ${newShared ? 'sekarang dibagikan' : 'sekarang private'}.`,
    })
  }

  const handleCopyLink = () => {
    // Dummy share link
    const shareLink = `https://sequoia.app/folder/${folder?.id || 'dummy'}`
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    addToast({
      title: 'Link disalin',
      description: 'Share link telah disalin ke clipboard.',
      variant: 'success',
    })
    setTimeout(() => setCopied(false), 2000)
  }

  if (!folder) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="share-toggle">Share folder</Label>
              <p className="text-sm text-muted-foreground">
                Allow others to access this folder
              </p>
            </div>
            <Switch
              id="share-toggle"
              checked={isShared}
              onCheckedChange={handleToggleShare}
            />
          </div>

          {isShared && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-muted-foreground truncate">
                    https://sequoia.app/folder/{folder.id}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>People with access</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>You (Owner)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  No other people have access yet
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
