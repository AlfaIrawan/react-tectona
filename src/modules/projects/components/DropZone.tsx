import { cn } from '@/lib/utils'
import { FolderOpen } from 'lucide-react'

interface DropZoneProps {
  isOver: boolean
  children?: React.ReactNode
  className?: string
}

export function DropZone({ isOver, children, className }: DropZoneProps) {
  return (
    <div
      className={cn(
        'liquid-glass-enterprise-panel rounded-xl p-8 border-2 border-dashed transition-all',
        isOver
          ? 'border-primary bg-primary/5 shadow-lg'
          : 'border-border hover:border-primary/50',
        className
      )}
    >
      {isOver ? (
        <div className="flex flex-col items-center justify-center gap-2 text-primary">
          <FolderOpen className="w-8 h-8" />
          <p className="text-sm font-medium">Drop here to move to All Projects</p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
