import { cn } from '@/lib/utils'

/** Generic "Select" pill switch — same chrome as the Workspace Directory table's row-selection
 * toggle, for showing/hiding a leading checkbox column on any enterprise data table. */

export interface EnterpriseSelectionToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  title?: string
}

export function EnterpriseSelectionToggle({
  checked,
  onChange,
  label = 'Select',
  title = 'Show/Hide selection checkboxes',
}: EnterpriseSelectionToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1 shadow-sm transition hover:bg-muted/40"
      title={title}
    >
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted')}>
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
            checked ? 'left-0.5 translate-x-4' : 'left-0.5 translate-x-0',
          )}
        />
      </span>
    </button>
  )
}
