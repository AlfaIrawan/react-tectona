import {
  Bug,
  CheckCircle2,
  CheckSquare2,
  ClipboardList,
  CornerDownRight,
  GitBranch,
  Layers3,
  type LucideIcon,
} from 'lucide-react'
import type { WorkItemType } from '@/lib/api/workApi'
import { cn } from '@/lib/utils'

export const WORK_ITEM_TYPE_OPTIONS: Array<{
  type: WorkItemType
  label: string
  icon: LucideIcon
  iconClass: string
}> = [
  { type: 'Epic', label: 'Epic', icon: Layers3, iconClass: 'text-violet-600' },
  { type: 'Feature', label: 'Feature', icon: GitBranch, iconClass: 'text-sky-600' },
  { type: 'Task', label: 'Task', icon: CheckSquare2, iconClass: 'text-blue-600' },
  { type: 'Subtask', label: 'Subtask', icon: CornerDownRight, iconClass: 'text-amber-600' },
  { type: 'Checklist', label: 'Checklist', icon: ClipboardList, iconClass: 'text-emerald-600' },
  { type: 'Bug', label: 'Bug', icon: Bug, iconClass: 'text-rose-600' },
]

export const WORK_ITEM_TYPE_META = Object.fromEntries(
  WORK_ITEM_TYPE_OPTIONS.map((option) => [option.type, option]),
) as Record<WorkItemType, (typeof WORK_ITEM_TYPE_OPTIONS)[number]>

export function WorkItemTypeIcon({ type, className }: { type: WorkItemType; className?: string }) {
  const meta = WORK_ITEM_TYPE_META[type]
  const Icon = meta.icon
  return <Icon className={cn('h-4 w-4 shrink-0', meta.iconClass, className)} aria-hidden />
}

export function renderWorkItemTypeSelectOption(
  option: { value: WorkItemType; label: string },
  selected: boolean,
) {
  const meta = WORK_ITEM_TYPE_META[option.value]
  const OptionIcon = meta.icon
  return (
    <>
      <span className="flex items-center gap-2">
        <OptionIcon
          className={cn('h-4 w-4 shrink-0', selected ? 'text-primary-foreground' : meta.iconClass)}
          aria-hidden
        />
        {option.label}
      </span>
      {selected ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  )
}
