import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  Bug,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CornerDownRight,
  FolderTree,
  GitBranch,
  GripVertical,
  Layers3,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type StructureWorkItemType = 'Task' | 'Subtask' | 'Checklist' | 'Epic' | 'Feature' | 'Bug'
export type StructureWorkStatus = 'Backlog' | 'To Do' | 'In Progress' | 'In Review' | 'Done'

export type StructureWorkItem = {
  id: string
  title: string
  type: StructureWorkItemType
  project: string
  workspace: string
  assignee: string
  status: StructureWorkStatus
  progress: number
  dueDate: string
  parentId?: string
  epicId?: string
  featureId?: string
}

type StructureTreeNode = {
  item: StructureWorkItem
  depth: number
  children: StructureTreeNode[]
}

const ALLOWED_CHILDREN: Record<StructureWorkItemType, StructureWorkItemType[]> = {
  Epic: ['Feature'],
  Feature: ['Task'],
  Task: ['Subtask', 'Checklist'],
  Subtask: ['Subtask', 'Checklist'],
  Checklist: [],
  Bug: ['Subtask', 'Checklist'],
}

const ROOT_DETACHABLE_TYPES: StructureWorkItemType[] = ['Feature', 'Task', 'Bug']

const TYPE_META: Record<
  StructureWorkItemType,
  { label: string; icon: LucideIcon; chip: string; iconClass: string }
> = {
  Epic: {
    label: 'Epic',
    icon: Layers3,
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-100',
    iconClass: 'text-violet-600',
  },
  Feature: {
    label: 'Feature',
    icon: GitBranch,
    chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/50 dark:text-sky-100',
    iconClass: 'text-sky-600',
  },
  Task: {
    label: 'Task',
    icon: CheckSquare2,
    chip: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-100',
    iconClass: 'text-blue-600',
  },
  Subtask: {
    label: 'Subtask',
    icon: CornerDownRight,
    chip: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-100',
    iconClass: 'text-amber-600',
  },
  Checklist: {
    label: 'Checklist',
    icon: ClipboardList,
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-100',
    iconClass: 'text-emerald-600',
  },
  Bug: {
    label: 'Bug',
    icon: Bug,
    chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/50 dark:text-rose-100',
    iconClass: 'text-rose-600',
  },
}

const STATUS_CHIP: Record<StructureWorkStatus, string> = {
  Backlog: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-100',
  'To Do': 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-100',
  'In Progress': 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-100',
  'In Review': 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-100',
  Done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-100',
}

const UNGROUPED_DROP_ID = 'structure-drop:ungrouped'

function dragIdFor(itemId: string) {
  return `structure-drag:${itemId}`
}

function dropIdFor(itemId: string) {
  return `structure-drop:${itemId}`
}

function parseDragId(id: string | number): string | null {
  const value = String(id)
  return value.startsWith('structure-drag:') ? value.slice('structure-drag:'.length) : null
}

function parseDropTarget(id: string | number | undefined | null): { kind: 'item'; itemId: string } | { kind: 'ungrouped' } | null {
  if (id == null) return null
  const value = String(id)
  if (value === UNGROUPED_DROP_ID) return { kind: 'ungrouped' }
  if (value.startsWith('structure-drop:')) return { kind: 'item', itemId: value.slice('structure-drop:'.length) }
  return null
}

function resolveParentId(item: StructureWorkItem, itemIds: Set<string>): string | null {
  if (item.parentId && itemIds.has(item.parentId)) return item.parentId
  if (item.featureId && itemIds.has(item.featureId)) return item.featureId
  if (item.epicId && itemIds.has(item.epicId)) return item.epicId
  return null
}

function buildStructureForest(items: StructureWorkItem[]): {
  epicRoots: StructureTreeNode[]
  ungroupedRoots: StructureTreeNode[]
} {
  const itemIds = new Set(items.map((entry) => entry.id))
  const childrenByParent = new Map<string, StructureWorkItem[]>()
  const roots: StructureWorkItem[] = []
  const order = new Map(items.map((entry, index) => [entry.id, index]))

  for (const item of items) {
    const parentId = resolveParentId(item, itemIds)
    if (parentId) {
      const siblings = childrenByParent.get(parentId) ?? []
      siblings.push(item)
      childrenByParent.set(parentId, siblings)
    } else {
      roots.push(item)
    }
  }

  const byListOrder = (left: StructureWorkItem, right: StructureWorkItem) =>
    (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)

  const buildNodes = (list: StructureWorkItem[], depth: number): StructureTreeNode[] =>
    [...list].sort(byListOrder).map((item) => ({
      item,
      depth,
      children: buildNodes(childrenByParent.get(item.id) ?? [], depth + 1),
    }))

  const forest = buildNodes(roots, 0)
  return {
    epicRoots: forest.filter((node) => node.item.type === 'Epic'),
    ungroupedRoots: forest.filter((node) => node.item.type !== 'Epic'),
  }
}

function countDescendants(node: StructureTreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

function collectExpandableIds(nodes: StructureTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (list: StructureTreeNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.push(node.item.id)
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return ids
}

function formatDue(dueDate: string): string {
  const trimmed = dueDate?.trim()
  if (!trimmed) return '—'
  const parsed = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return trimmed.slice(0, 10)
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function canItemBeDragged(item: StructureWorkItem): boolean {
  return item.type !== 'Epic'
}

function canItemAcceptChildren(item: StructureWorkItem): boolean {
  return ALLOWED_CHILDREN[item.type].length > 0
}

function itemHasParent(item: StructureWorkItem, itemIds: Set<string>): boolean {
  return resolveParentId(item, itemIds) != null
}

type EpicStructureTreePanelProps = {
  items: StructureWorkItem[]
  disabled?: boolean
  reparentHint?: string | null
  onOpenItem: (id: string) => void
  onAddEpic: () => void
  onAddChild: (parent: StructureWorkItem, childType: StructureWorkItemType) => void
  onCanDrop: (draggedId: string, parentId: string) => boolean
  onReparent: (draggedId: string, parentId: string) => void
  onCanDetach: (draggedId: string) => boolean
  onDetach: (draggedId: string) => void
  onReparentRejected?: (message: string) => void
}

function StructureDropRow({
  item,
  depth,
  hasChildren,
  isExpanded,
  descendantCount,
  disabled,
  dropHighlight,
  onToggle,
  onOpen,
  onAddChild,
  dragHandle,
  children,
}: {
  item: StructureWorkItem
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  descendantCount: number
  disabled: boolean
  dropHighlight: 'valid' | 'invalid' | null
  onToggle: () => void
  onOpen: () => void
  onAddChild: (childType: StructureWorkItemType) => void
  dragHandle: ReactNode
  children?: ReactNode
}) {
  const meta = TYPE_META[item.type]
  const TypeIcon = meta.icon
  const { setNodeRef, isOver } = useDroppable({
    id: dropIdFor(item.id),
    disabled: disabled || !canItemAcceptChildren(item),
  })
  const primaryChildType = ALLOWED_CHILDREN[item.type][0]
  const highlight = dropHighlight ?? (isOver ? 'valid' : null)

  return (
    <div className="min-w-0">
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
        className={cn(
          'group flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-left transition-colors',
          'hover:border-border/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
          highlight === 'valid' && 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/40',
          highlight === 'invalid' && 'border-rose-300 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/40',
          !highlight && 'border-transparent'
        )}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        {dragHandle}

        <button
          type="button"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted',
            !hasChildren && 'invisible'
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          onClick={(event) => {
            event.stopPropagation()
            onToggle()
          }}
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/70',
            meta.iconClass
          )}
        >
          <TypeIcon className="h-3.5 w-3.5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('rounded-full px-1.5 py-0 text-[10px] font-semibold', meta.chip)}>
              {meta.label}
            </Badge>
            <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="truncate">{item.project || 'No project'}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{item.assignee || 'Unassigned'}</span>
            {hasChildren ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {descendantCount} child{descendantCount === 1 ? '' : 'ren'}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="w-16">
            <div className="mb-0.5 text-right text-[10px] font-semibold tabular-nums text-muted-foreground">
              {item.progress}%
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
              />
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_CHIP[item.status])}
          >
            {item.status}
          </Badge>
          <span className="w-14 text-right text-[11px] tabular-nums text-muted-foreground">
            {formatDue(item.dueDate)}
          </span>
        </div>

        {primaryChildType && !disabled ? (
          <button
            type="button"
            title={`Add ${primaryChildType}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground opacity-0 transition-opacity hover:border-primary/40 hover:text-primary group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              onAddChild(primaryChildType)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="h-7 w-7 shrink-0" aria-hidden />
        )}
      </div>
      {children}
    </div>
  )
}

function StructureDragHandle({
  itemId,
  disabled,
}: {
  itemId: string
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragIdFor(itemId),
    disabled,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        'flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing',
        disabled && 'invisible cursor-default',
        isDragging && 'opacity-40'
      )}
      aria-label="Drag to reparent"
      title="Drag onto a parent to reparent"
      onClick={(event) => event.stopPropagation()}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  )
}

function StructureDragPreview({ item }: { item: StructureWorkItem }) {
  const meta = TYPE_META[item.type]
  const TypeIcon = meta.icon
  return (
    <div className="flex max-w-sm items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-lg">
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg bg-muted', meta.iconClass)}>
        <TypeIcon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <Badge variant="outline" className={cn('rounded-full px-1.5 py-0 text-[10px]', meta.chip)}>
          {meta.label}
        </Badge>
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
      </div>
    </div>
  )
}

export function EpicStructureTreePanel({
  items,
  disabled = false,
  reparentHint = null,
  onOpenItem,
  onAddEpic,
  onAddChild,
  onCanDrop,
  onReparent,
  onCanDetach,
  onDetach,
  onReparentRejected,
}: EpicStructureTreePanelProps) {
  const { epicRoots, ungroupedRoots } = useMemo(() => buildStructureForest(items), [items])
  const allRoots = useMemo(() => [...epicRoots, ...ungroupedRoots], [epicRoots, ungroupedRoots])
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const expandableKey = useMemo(
    () => collectExpandableIds(allRoots).slice().sort().join('|'),
    [allRoots]
  )

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [ungroupedExpanded, setUngroupedExpanded] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overDropId, setOverDropId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const {
    setNodeRef: setUngroupedDropRef,
    isOver: isOverUngrouped,
  } = useDroppable({
    id: UNGROUPED_DROP_ID,
    disabled: disabled || !activeDragId || !onCanDetach(activeDragId),
  })

  useEffect(() => {
    setExpandedIds(new Set(collectExpandableIds(allRoots)))
    setUngroupedExpanded(true)
  }, [expandableKey, allRoots])

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpandedIds(new Set(collectExpandableIds(allRoots)))
  const collapseAll = () => setExpandedIds(new Set())

  const dropHighlightFor = (targetItemId: string): 'valid' | 'invalid' | null => {
    if (!activeDragId || overDropId !== targetItemId) return null
    if (activeDragId === targetItemId) return 'invalid'
    return onCanDrop(activeDragId, targetItemId) ? 'valid' : 'invalid'
  }

  const ungroupedHighlight: 'valid' | 'invalid' | null =
    activeDragId && (overDropId === 'ungrouped' || isOverUngrouped)
      ? onCanDetach(activeDragId)
        ? 'valid'
        : 'invalid'
      : null

  const handleDragStart = (event: DragStartEvent) => {
    const id = parseDragId(event.active.id)
    setActiveDragId(id)
    setOverDropId(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const target = parseDropTarget(event.over?.id)
    if (!target) {
      setOverDropId(null)
      return
    }
    setOverDropId(target.kind === 'ungrouped' ? 'ungrouped' : target.itemId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedId = parseDragId(event.active.id)
    const target = parseDropTarget(event.over?.id)
    setActiveDragId(null)
    setOverDropId(null)
    if (!draggedId || !target || disabled) return

    if (target.kind === 'ungrouped') {
      if (!onCanDetach(draggedId)) {
        onReparentRejected?.('This item must stay under a parent and cannot move to Ungrouped.')
        return
      }
      onDetach(draggedId)
      setUngroupedExpanded(true)
      return
    }

    if (draggedId === target.itemId) return
    if (!onCanDrop(draggedId, target.itemId)) {
      onReparentRejected?.('That drop target is not a valid parent for this work item type.')
      return
    }

    onReparent(draggedId, target.itemId)
    setExpandedIds((current) => new Set([...current, target.itemId]))
  }

  const handleDragCancel = () => {
    setActiveDragId(null)
    setOverDropId(null)
  }

  const renderNode = (node: StructureTreeNode): ReactNode => {
    const { item, depth, children } = node
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(item.id)
    const descendantCount = hasChildren ? countDescendants(node) : 0
    const draggable = canItemBeDragged(item) && !disabled

    return (
      <StructureDropRow
        key={item.id}
        item={item}
        depth={depth}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        descendantCount={descendantCount}
        disabled={disabled}
        dropHighlight={dropHighlightFor(item.id)}
        onToggle={() => toggleExpanded(item.id)}
        onOpen={() => onOpenItem(item.id)}
        onAddChild={(childType) => onAddChild(item, childType)}
        dragHandle={<StructureDragHandle itemId={item.id} disabled={!draggable} />}
      >
        {hasChildren && isExpanded ? (
          <div className="min-w-0">{children.map((child) => renderNode(child))}</div>
        ) : null}
      </StructureDropRow>
    )
  }

  const isEmpty = items.length === 0
  const activeItem = activeDragId ? itemById.get(activeDragId) ?? null : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="shrink-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Layers3 className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Epic & Feature Structure</h2>
              </div>
              <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">
                Hierarchy browser from epic down to checklist. Drag the grip handle onto a valid parent to reparent.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 overflow-x-auto py-1 whitespace-nowrap text-xs text-muted-foreground scrollbar-hide">
              <span>
                <span className="font-semibold text-foreground">{epicRoots.length}</span> epic
                {epicRoots.length === 1 ? '' : 's'}
                {ungroupedRoots.length > 0 ? (
                  <>
                    {' · '}
                    <span className="font-semibold text-foreground">{ungroupedRoots.length}</span> ungrouped
                  </>
                ) : null}
              </span>
              <div
                className="inline-flex items-center rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
                role="group"
                aria-label="Structure tree expand controls"
              >
                <button
                  type="button"
                  onClick={expandAll}
                  disabled={allRoots.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  disabled={allRoots.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
                >
                  Collapse all
                </button>
              </div>
            </div>
          </div>

          {reparentHint ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
              {reparentHint}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isEmpty ? (
            <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center px-6">
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card/85 px-8 py-11 text-center shadow-[0_22px_55px_-18px_rgba(15,23,42,0.12)] backdrop-blur-md dark:bg-slate-950/75">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-400/35 to-transparent" />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-muted/80 ring-1 ring-border/70 dark:bg-white/[0.06]">
                  <FolderTree className="h-7 w-7 text-muted-foreground" aria-hidden />
                </div>
                <p className="mt-5 text-lg font-semibold tracking-tight text-foreground">No hierarchy in scope yet</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Create an Epic to start the tree. Features and tasks without an Epic parent appear under Ungrouped.
                </p>
                <div className="mt-5">
                  <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={onAddEpic} disabled={disabled}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Epic
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              {epicRoots.length > 0 ? (
                <div className="space-y-0.5">{epicRoots.map((node) => renderNode(node))}</div>
              ) : null}

              <div
                ref={setUngroupedDropRef}
                className={cn(
                  'rounded-xl transition-colors',
                  epicRoots.length > 0 && 'mt-3 border-t border-border/50 pt-2',
                  ungroupedHighlight === 'valid' && 'bg-emerald-50/70 ring-1 ring-emerald-300 dark:bg-emerald-950/30',
                  ungroupedHighlight === 'invalid' && 'bg-rose-50/70 ring-1 ring-rose-300 dark:bg-rose-950/30'
                )}
              >
                <button
                  type="button"
                  className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted/40"
                  onClick={() => setUngroupedExpanded((current) => !current)}
                >
                  {ungroupedExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Ungrouped
                  <span className="font-medium normal-case tracking-normal text-muted-foreground/80">
                    ({ungroupedRoots.length} root{ungroupedRoots.length === 1 ? '' : 's'} without Epic)
                    {activeDragId ? ' · drop here to detach' : ''}
                  </span>
                </button>
                {ungroupedExpanded ? (
                  ungroupedRoots.length > 0 ? (
                    <div className="space-y-0.5">{ungroupedRoots.map((node) => renderNode(node))}</div>
                  ) : (
                    <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                      No ungrouped roots. Drop a Feature, Task, or Bug here to detach it from its parent.
                    </p>
                  )
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? <StructureDragPreview item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

export function canDetachStructureItem(item: StructureWorkItem, allItems: StructureWorkItem[]): boolean {
  if (!ROOT_DETACHABLE_TYPES.includes(item.type)) return false
  const ids = new Set(allItems.map((entry) => entry.id))
  return itemHasParent(item, ids)
}