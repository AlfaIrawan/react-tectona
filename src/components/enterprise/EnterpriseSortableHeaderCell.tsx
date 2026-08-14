import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpDown, ChevronDown, ChevronUp, GripVertical, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Generic sortable/resizable/draggable <th> — same visual chrome as the Workspace Directory table's
 * header cells (grip handle, 3-state sort toggle, optional per-column filter slot, resize handle,
 * right-click column menu), parameterized over any column key type so other tables can adopt it. */

export interface EnterpriseSortableHeaderCellProps<K extends string> {
  columnKey: K
  label: string
  icon: LucideIcon
  isPinned: boolean
  isFirstColumn: boolean
  isLastColumn: boolean
  widthStyle?: CSSProperties
  sortDir: 'asc' | 'desc' | null
  onToggleSort: (key: K) => void
  /** Rendered next to the sort control — typically a per-column multi-select filter dropdown. */
  filterSlot?: ReactNode
  frozenColumnClass?: string
  firstColumnTintClass?: string
  isResizing: boolean
  onBeginResize: (key: K, startX: number, th: HTMLTableCellElement) => void
  onContextMenu: (event: React.MouseEvent<HTMLTableCellElement>, key: K) => void
}

export function EnterpriseSortableHeaderCell<K extends string>({
  columnKey,
  label,
  icon: HeaderIcon,
  isPinned,
  isFirstColumn,
  isLastColumn,
  widthStyle,
  sortDir,
  onToggleSort,
  filterSlot,
  frozenColumnClass,
  firstColumnTintClass,
  isResizing,
  onBeginResize,
  onContextMenu,
}: EnterpriseSortableHeaderCellProps<K>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
    disabled: isPinned,
  })
  const style: CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    ...(widthStyle ?? {}),
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(event, columnKey)
      }}
      className={cn(
        'relative select-none border-b-[3px] border-double border-slate-300/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80',
        isFirstColumn ? firstColumnTintClass : 'bg-white/90 dark:bg-slate-900/90',
        isFirstColumn && frozenColumnClass,
        isDragging && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-1.5">
        {isPinned ? (
          <span className="inline-flex h-6 w-6 shrink-0" aria-hidden />
        ) : (
          <button
            type="button"
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70',
              'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              'cursor-grab active:cursor-grabbing',
            )}
            aria-label={`Arrange column: ${label}`}
            title="Drag to rearrange columns"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleSort(columnKey)}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          title="Sort: ascending → descending → default"
        >
          <HeaderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
          <span>{label}</span>
          {sortDir ? (
            sortDir === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          )}
        </button>

        {filterSlot}
      </div>

      {!isLastColumn ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label} column`}
          title="Drag to resize column"
          className={cn(
            'absolute top-0 right-0 z-30 h-full w-3 translate-x-1/2 cursor-col-resize touch-none',
            'hover:bg-sky-400/15 active:bg-sky-400/25',
            isResizing && 'bg-sky-400/30',
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const th = event.currentTarget.closest('th')
            if (!th) return
            onBeginResize(columnKey, event.clientX, th)
          }}
        />
      ) : null}
    </th>
  )
}
