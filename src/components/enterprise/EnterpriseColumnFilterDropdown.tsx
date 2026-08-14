import { CheckCircle2, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Generic per-column multi-select filter dropdown — same visual chrome as the Workspace Directory
 * table's Type/Owner/Governance Status column filters (funnel icon that lights up when active,
 * checkbox-style option list with per-option counts). */

export interface EnterpriseColumnFilterOption {
  value: string
  count?: number
}

export interface EnterpriseColumnFilterDropdownProps {
  label: string
  ariaLabel: string
  options: EnterpriseColumnFilterOption[]
  selected: Set<string>
  onToggleOption: (value: string) => void
  onShowAll: () => void
}

export function EnterpriseColumnFilterDropdown({
  label,
  ariaLabel,
  options,
  selected,
  onToggleOption,
  onShowAll,
}: EnterpriseColumnFilterDropdownProps) {
  const active = selected.size > 0
  const buttonClass = cn(
    'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
    'outline-none focus:outline-none focus-visible:outline-none',
    'focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
    active
      ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-900'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={buttonClass} aria-label={ariaLabel} title={`Filter ${label.toLowerCase()}`}>
          <Filter className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56 !bg-white !text-slate-900 dark:!bg-slate-950 dark:!text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg !backdrop-blur-none"
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{label} filter</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {selected.size === 0 ? 'All' : `${selected.size} selected`}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onShowAll} className="flex items-center justify-between">
          Show all
          {selected.size === 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <DropdownMenuItem className="pointer-events-none opacity-60">No {label.toLowerCase()}</DropdownMenuItem>
        ) : (
          options.map((option) => {
            const isActive = selected.size > 0 && selected.has(option.value)
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onToggleOption(option.value)}
                className="flex items-center justify-between"
              >
                <span className="truncate">
                  {option.value}
                  {typeof option.count === 'number' ? (
                    <span className="ml-1 tabular-nums text-[10px] text-muted-foreground">({option.count})</span>
                  ) : null}
                </span>
                {isActive ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden /> : null}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
