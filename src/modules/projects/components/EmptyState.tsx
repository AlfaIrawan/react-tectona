import { FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  /** Path ke gambar custom untuk menggantikan icon default (mis. /images/project.png) */
  imageSrc?: string
}

export function EmptyState({ title, description, actionLabel, onAction, imageSrc }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="flex items-center justify-center mb-4">
        {imageSrc ? (
          <img src={imageSrc} alt="" className="w-56 h-56 object-contain" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center">
            <FolderPlus className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="default">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
