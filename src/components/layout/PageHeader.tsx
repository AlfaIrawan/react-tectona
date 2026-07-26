import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  right?: ReactNode
  className?: string
}

export function PageHeader({ title, description, right, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : null}
      </div>
      {right ? <div className="flex-shrink-0 pt-0.5">{right}</div> : null}
    </div>
  )
}

