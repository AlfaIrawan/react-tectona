import { useState } from 'react'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import type { WorkspaceReadState } from '../lib/workspaceManagementReadState'

export function WorkspaceReadNotice({ title, state, onRetry }: {
  title: string
  state: WorkspaceReadState
  onRetry: () => void
}) {
  return (
    <div className="w-full rounded-lg border border-amber-200/60 bg-amber-50/60 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20" role="alert">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{state.reason}</p>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function WorkspaceAssetsTypeFilter<T extends string>({ options, selected, onClear, onToggle }: {
  options: readonly T[]
  selected: ReadonlySet<T>
  onClear: () => void
  onToggle: (type: T) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
      className="relative z-20 shrink-0 self-start lg:ml-auto"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          event.currentTarget.querySelector('button')?.focus()
        }
      }}
    >
      <DropdownMenuTrigger
        type="button"
        className={cn(enterpriseSecondaryButtonClass(), 'inline-flex h-9 items-center gap-2 px-3 text-xs')}
        aria-label="Filter asset types in table"
        aria-expanded={open}
      >
        <Filter className="h-3.5 w-3.5" aria-hidden />
        Type{selected.size ? ` (${selected.size})` : ': All'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
        <DropdownMenuLabel>Asset types</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <button type="button" className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted" onClick={onClear}>
          Show all
        </button>
        {options.map((type) => (
          <label key={type} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted">
            <input type="checkbox" checked={selected.has(type)} onChange={() => onToggle(type)} />
            {type}
          </label>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
