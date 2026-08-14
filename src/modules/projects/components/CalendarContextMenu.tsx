import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eye,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Priority, WorkItemType, WorkStatus } from '@/lib/api/workApi'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubmenu,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { resolveWorkItemTypeIconMeta } from '@/modules/task-work-management/components/DirectoryGanttGridCells'

const WORK_STATUSES: WorkStatus[] = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']
const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low']
const QUICK_ADD_TYPES: WorkItemType[] = ['Task', 'Bug', 'Epic', 'Feature', 'Subtask']
const WORK_TYPES: WorkItemType[] = ['Task', 'Bug', 'Epic', 'Feature', 'Subtask', 'Checklist']

export type CalendarContextMenuTarget =
  | { kind: 'day'; dayKey: string; x: number; y: number; anchorEl: HTMLElement }
  | {
      kind: 'task'
      dayKey: string
      taskId: string
      taskTitle: string
      taskType: WorkItemType
      status: WorkStatus
      priority: Priority
      x: number
      y: number
    }

export function CalendarContextMenu({
  target,
  hasTaskClipboard,
  onClose,
  onDayAddTask,
  onDayAddTaskWithType,
  onDayView,
  onDayGoToToday,
  onDayPasteTask,
  onTaskOpenDetail,
  onTaskMarkDone,
  onTaskSetStatus,
  onTaskSetPriority,
  onTaskSetType,
  onTaskMoveTo,
  onTaskPickDateMove,
  onTaskDuplicate,
  onTaskCopyTitle,
  onTaskCopyTask,
  onTaskDelete,
}: {
  target: CalendarContextMenuTarget | null
  hasTaskClipboard: boolean
  onClose: () => void
  onDayAddTask: (dayKey: string, anchorEl: HTMLElement) => void
  onDayAddTaskWithType: (dayKey: string, anchorEl: HTMLElement, type: WorkItemType) => void
  onDayView: (dayKey: string) => void
  onDayGoToToday: () => void
  onDayPasteTask: (dayKey: string) => void
  onTaskOpenDetail: (taskId: string, dayKey: string) => void
  onTaskMarkDone: (taskId: string) => void
  onTaskSetStatus: (taskId: string, status: WorkStatus) => void
  onTaskSetPriority: (taskId: string, priority: Priority) => void
  onTaskSetType: (taskId: string, type: WorkItemType) => void
  onTaskMoveTo: (taskId: string, viewDayKey: string, targetDayKey: string) => void
  onTaskPickDateMove: (taskId: string, viewDayKey: string) => void
  onTaskDuplicate: (taskId: string, viewDayKey: string) => void
  onTaskCopyTitle: (title: string) => void
  onTaskCopyTask: (taskId: string) => void
  onTaskDelete: (taskId: string, taskTitle: string) => void
}) {
  return (
    <ContextMenu open={target !== null} x={target?.x ?? 0} y={target?.y ?? 0} onClose={onClose}>
      {target?.kind === 'day' ? (
        <>
          <ContextMenuItem
            onSelect={() => {
              onDayAddTask(target.dayKey, target.anchorEl)
            }}
          >
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Add task…
          </ContextMenuItem>
          <ContextMenuSubmenu
            trigger={
              <>
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">Add task</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              </>
            }
          >
            {QUICK_ADD_TYPES.map((type) => {
              const meta = resolveWorkItemTypeIconMeta(type)
              const TypeIcon = meta.icon
              return (
                <ContextMenuItem
                  key={type}
                  onSelect={() => {
                    onDayAddTaskWithType(target.dayKey, target.anchorEl, type)
                  }}
                >
                  <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', meta.className)} aria-hidden />
                  <span className="flex-1">{type}</span>
                </ContextMenuItem>
              )
            })}
          </ContextMenuSubmenu>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              onDayView(target.dayKey)
            }}
          >
            <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            View this day
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              onDayGoToToday()
            }}
          >
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Go to today
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className={!hasTaskClipboard ? 'pointer-events-none opacity-45' : undefined}
            onSelect={() => {
              if (!hasTaskClipboard) return
              onDayPasteTask(target.dayKey)
            }}
          >
            <ClipboardPaste className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Paste task
          </ContextMenuItem>
        </>
      ) : null}

      {target?.kind === 'task' ? (
        <>
          <ContextMenuItem
            onSelect={() => {
              onTaskOpenDetail(target.taskId, target.dayKey)
            }}
          >
            View detail
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSubmenu
            trigger={
              <>
                <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">Change status</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              </>
            }
          >
            {WORK_STATUSES.map((status) => (
              <ContextMenuItem
                key={status}
                onSelect={() => {
                  onTaskSetStatus(target.taskId, status)
                }}
              >
                <span className="flex-1">{status}</span>
                {status === target.status ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                ) : null}
              </ContextMenuItem>
            ))}
          </ContextMenuSubmenu>
          <ContextMenuSubmenu
            trigger={
              <>
                <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">Change priority</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              </>
            }
          >
            {PRIORITIES.map((priority) => (
              <ContextMenuItem
                key={priority}
                onSelect={() => {
                  onTaskSetPriority(target.taskId, priority)
                }}
              >
                <span className="flex-1">{priority}</span>
                {priority === target.priority ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                ) : null}
              </ContextMenuItem>
            ))}
          </ContextMenuSubmenu>
          <ContextMenuSubmenu
            trigger={
              <>
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">Change type</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              </>
            }
          >
            {WORK_TYPES.map((type) => {
              const meta = resolveWorkItemTypeIconMeta(type)
              const TypeIcon = meta.icon
              return (
                <ContextMenuItem
                  key={type}
                  onSelect={() => {
                    onTaskSetType(target.taskId, type)
                  }}
                >
                  <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', meta.className)} aria-hidden />
                  <span className="flex-1">{type}</span>
                  {type === target.taskType ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </ContextMenuItem>
              )
            })}
          </ContextMenuSubmenu>
          <ContextMenuSubmenu
            trigger={
              <>
                <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">Move to</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              </>
            }
          >
            <ContextMenuItem
              onSelect={() => {
                onTaskMoveTo(target.taskId, target.dayKey, 'tomorrow')
              }}
            >
              Tomorrow
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                onTaskMoveTo(target.taskId, target.dayKey, 'next-week')
              }}
            >
              Next week
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                onTaskPickDateMove(target.taskId, target.dayKey)
              }}
            >
              Pick date…
            </ContextMenuItem>
          </ContextMenuSubmenu>
          <ContextMenuSeparator />
          <ContextMenuItem
            className={target.status === 'Done' ? 'pointer-events-none opacity-45' : undefined}
            onSelect={() => {
              if (target.status === 'Done') return
              onTaskMarkDone(target.taskId)
            }}
          >
            <Check className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Mark as done
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              onTaskDuplicate(target.taskId, target.dayKey)
            }}
          >
            <CopyPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Duplicate
          </ContextMenuItem>
          <ContextMenuSubmenu
            trigger={
              <>
                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">Copy</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              </>
            }
          >
            <ContextMenuItem
              onSelect={() => {
                onTaskCopyTitle(target.taskTitle)
              }}
            >
              Copy title
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                onTaskCopyTask(target.taskId)
              }}
            >
              Copy task
            </ContextMenuItem>
          </ContextMenuSubmenu>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-rose-600 focus:text-rose-600"
            onSelect={() => {
              onTaskDelete(target.taskId, target.taskTitle)
            }}
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            Delete…
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenu>
  )
}
