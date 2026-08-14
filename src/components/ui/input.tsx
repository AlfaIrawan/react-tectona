import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

function sanitizeAutoName(id: string): string {
  return id.replace(/:/g, '')
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, id, name, ...props }, ref) => {
    const autoId = React.useId()
    const resolvedId = id ?? autoId
    const resolvedName = name ?? (id === undefined ? sanitizeAutoName(autoId) : undefined)

    return (
      <input
        type={type}
        id={resolvedId}
        name={resolvedName}
        className={cn(
          'flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
