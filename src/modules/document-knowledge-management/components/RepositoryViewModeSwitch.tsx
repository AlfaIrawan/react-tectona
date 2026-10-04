import { LayoutGrid, LayoutList, List } from 'lucide-react'

import { cn } from '@/lib/utils'

export type RepositoryLayoutMode = 'folders' | 'split' | 'explorer'

const MODES: Array<{ mode: RepositoryLayoutMode; label: string; title: string; icon: typeof LayoutGrid }> = [
  { mode: 'folders', label: 'Folder card view', title: 'Folder card view', icon: LayoutGrid },
  { mode: 'split', label: 'Split folder view', title: 'Split folder view', icon: LayoutList },
  { mode: 'explorer', label: 'Explorer details view', title: 'Explorer details view', icon: List },
]

export function RepositoryViewModeSwitch({
  value,
  onChange,
}: {
  value: RepositoryLayoutMode
  onChange: (mode: RepositoryLayoutMode) => void
}) {
  return (
    <div
      className="flex h-10 items-center gap-0.5 rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
      role="group"
      aria-label="View mode"
    >
      {MODES.map(({ mode, label, title, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          title={title}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            value === mode
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}
