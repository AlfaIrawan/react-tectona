import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical, Inbox, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type OwnershipPanelWorkItem = {
  id: string
  title: string
  type: string
  status: string
  assignee: string
  team: string
  role: string
  workspace: string
  dueDate: string
  project: string
}

const LOAD_CAPACITY = 3
const LANE_PREFIX = 'lane:'
const CARD_PREFIX = 'card:'

type OwnershipAssignmentPanelProps = {
  items: OwnershipPanelWorkItem[]
  assigneeOptions: string[]
  resolveAssigneeOptions?: (item: OwnershipPanelWorkItem) => string[]
  search?: string
  disabled?: boolean
  onOpenItem: (id: string) => void
  onAssign: (itemId: string, assignee: string) => void | Promise<void>
  onBulkAssign: (itemIds: string[], assignee: string) => void | Promise<void>
}

function parseDueDate(value?: string | null): Date | null {
  if (!value?.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isOverdue(item: OwnershipPanelWorkItem, today: Date): boolean {
  if (item.status === 'Done') return false
  const due = parseDueDate(item.dueDate)
  return due != null && startOfDay(due) < today
}

function personInitials(name: string): string {
  const normalized = name.trim()
  if (!normalized || normalized === 'Unassigned') return '?'
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function laneId(assignee: string): string {
  return `${LANE_PREFIX}${assignee}`
}

function parseLaneId(id: string | undefined): string | null {
  if (!id?.startsWith(LANE_PREFIX)) return null
  return id.slice(LANE_PREFIX.length)
}

function cardId(itemId: string): string {
  return `${CARD_PREFIX}${itemId}`
}

function parseCardId(id: string | undefined): string | null {
  if (!id?.startsWith(CARD_PREFIX)) return null
  return id.slice(CARD_PREFIX.length)
}

export function OwnershipAssignmentPanel({
  items,
  assigneeOptions,
  search = '',
  disabled = false,
  onOpenItem,
  onAssign,
  onBulkAssign,
}: OwnershipAssignmentPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [focusLane, setFocusLane] = useState<'unassigned' | 'all'>('unassigned')

  const today = useMemo(() => startOfDay(new Date()), [])
  const query = search.trim().toLowerCase()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const filteredItems = useMemo(() => {
    if (!query) return items
    return items.filter((item) =>
      [item.title, item.id, item.type, item.assignee, item.project, item.workspace, item.team]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [items, query])

  const peopleLanes = useMemo(() => {
    const names = new Set<string>()
    for (const name of assigneeOptions) {
      if (name && name !== 'Unassigned') names.add(name)
    }
    for (const item of filteredItems) {
      const assignee = item.assignee?.trim() || 'Unassigned'
      if (assignee !== 'Unassigned') names.add(assignee)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [assigneeOptions, filteredItems])

  const itemsByAssignee = useMemo(() => {
    const map = new Map<string, OwnershipPanelWorkItem[]>()
    map.set('Unassigned', [])
    for (const name of peopleLanes) map.set(name, [])

    for (const item of filteredItems) {
      const key = item.assignee?.trim() || 'Unassigned'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [filteredItems, peopleLanes])

  const unassignedItems = itemsByAssignee.get('Unassigned') ?? []
  const activeItem = activeCardId
    ? filteredItems.find((item) => item.id === activeCardId) ?? null
    : null

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }

  async function assignItems(itemIds: string[], assignee: string) {
    if (disabled || saving || itemIds.length === 0) return
    const uniqueIds = Array.from(new Set(itemIds))
    const needsChange = uniqueIds.filter((id) => {
      const item = items.find((entry) => entry.id === id)
      return item && (item.assignee?.trim() || 'Unassigned') !== assignee
    })
    if (needsChange.length === 0) return

    setSaving(true)
    try {
      if (needsChange.length === 1) {
        await onAssign(needsChange[0], assignee)
      } else {
        await onBulkAssign(needsChange, assignee)
      }
      setSelectedIds((current) => current.filter((id) => !needsChange.includes(id)))
    } finally {
      setSaving(false)
    }
  }

  async function handleLaneClick(assignee: string) {
    if (selectedIds.length === 0) return
    await assignItems(selectedIds, assignee)
  }

  function handleDragStart(event: DragStartEvent) {
    const id = parseCardId(String(event.active.id))
    setActiveCardId(id)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const itemId = parseCardId(String(event.active.id))
    const targetLane = parseLaneId(
      event.over ? String(event.over.id) : undefined,
    )
    setActiveCardId(null)
    if (!itemId || !targetLane || disabled) return
    await assignItems([itemId], targetLane)
  }

  const visiblePeople = focusLane === 'all'
    ? peopleLanes
    : peopleLanes.filter((name) => (itemsByAssignee.get(name)?.length ?? 0) > 0)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
              <h2 className="text-lg font-semibold text-foreground">Assignment Board</h2>
            </div>
            <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">
              Drag work item ke orang, atau pilih dulu lalu klik lane tujuan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{unassignedItems.length}</span> need owner
              {selectedIds.length > 0 ? (
                <>
                  {' · '}
                  <span className="font-semibold text-foreground">{selectedIds.length}</span> selected
                </>
              ) : null}
            </span>
            <div className="inline-flex rounded-lg border border-border bg-background/80 p-0.5">
              <button
                type="button"
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium',
                  focusLane === 'unassigned'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFocusLane('unassigned')}
              >
                Triage
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium',
                  focusLane === 'all'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFocusLane('all')}
              >
                All people
              </button>
            </div>
            {selectedIds.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedIds([])}
              >
                Clear selection
              </Button>
            ) : null}
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-xs text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-100">
            {selectedIds.length} item dipilih — klik nama orang di lane kanan untuk assign, atau drag ke lane.
          </div>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={() => setActiveCardId(null)}
      >
        <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
          <LaneColumn
            assignee="Unassigned"
            title="Needs owner"
            subtitle="Triage queue"
            items={unassignedItems}
            today={today}
            accent="amber"
            selectedIds={selectedIds}
            disabled={disabled || saving}
            showDropHint={selectedIds.length > 0}
            onToggleSelect={toggleSelected}
            onOpenItem={onOpenItem}
            onHeaderAction={() => void handleLaneClick('Unassigned')}
            headerActionLabel={selectedIds.length > 0 ? 'Move here' : undefined}
          />

          <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto pb-1">
            {visiblePeople.length === 0 ? (
              <div className="flex min-w-[280px] flex-1 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-foreground">Belum ada assignee aktif</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Switch ke All people, atau pastikan anggota workspace tersedia di directory assignee.
                  </p>
                </div>
              </div>
            ) : (
              visiblePeople.map((name) => {
                const laneItems = itemsByAssignee.get(name) ?? []
                const overdue = laneItems.filter((item) => isOverdue(item, today)).length
                const overloaded = laneItems.length >= LOAD_CAPACITY || overdue > 0
                return (
                  <LaneColumn
                    key={name}
                    assignee={name}
                    title={name}
                    subtitle={`${laneItems.length}/${LOAD_CAPACITY} load${overdue > 0 ? ` · ${overdue} overdue` : ''}`}
                    items={laneItems}
                    today={today}
                    accent={overloaded ? 'rose' : 'default'}
                    selectedIds={selectedIds}
                    disabled={disabled || saving}
                    showDropHint={selectedIds.length > 0}
                    onToggleSelect={toggleSelected}
                    onOpenItem={onOpenItem}
                    onHeaderAction={() => void handleLaneClick(name)}
                    headerActionLabel={selectedIds.length > 0 ? 'Assign here' : undefined}
                  />
                )
              })
            )}
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="w-[240px] rounded-xl border border-border bg-card p-3 shadow-xl">
              <p className="truncate text-xs font-semibold text-foreground">{activeItem.title}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {activeItem.type} · {activeItem.status}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function LaneColumn({
  assignee,
  title,
  subtitle,
  items,
  today,
  accent,
  selectedIds,
  disabled,
  showDropHint,
  onToggleSelect,
  onOpenItem,
  onHeaderAction,
  headerActionLabel,
}: {
  assignee: string
  title: string
  subtitle: string
  items: OwnershipPanelWorkItem[]
  today: Date
  accent: 'amber' | 'rose' | 'default'
  selectedIds: string[]
  disabled: boolean
  showDropHint: boolean
  onToggleSelect: (id: string) => void
  onOpenItem: (id: string) => void
  onHeaderAction?: () => void
  headerActionLabel?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: laneId(assignee),
    disabled,
  })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-background/70',
        accent === 'amber' && 'border-amber-200/80 dark:border-amber-800/40',
        accent === 'rose' && 'border-rose-200/70 dark:border-rose-800/40',
        accent === 'default' && 'border-border/60',
        isOver && 'ring-2 ring-sky-400/70',
        showDropHint && !isOver && 'border-dashed',
      )}
    >
      <header className="shrink-0 border-b border-border/50 px-3 py-3">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1',
              accent === 'amber'
                ? 'bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100'
                : accent === 'rose'
                  ? 'bg-rose-50 text-rose-700 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-100'
                  : 'bg-muted text-foreground ring-border/60',
            )}
          >
            {assignee === 'Unassigned' ? <Inbox className="h-3.5 w-3.5" /> : personInitials(assignee)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {headerActionLabel && onHeaderAction ? (
          <Button
            type="button"
            size="sm"
            className="mt-2 h-8 w-full rounded-full text-xs"
            disabled={disabled}
            onClick={onHeaderAction}
          >
            {headerActionLabel}
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">
            {assignee === 'Unassigned' ? 'Tidak ada item tanpa owner.' : 'Drop item ke sini untuk assign.'}
          </p>
        ) : (
          items.map((item) => (
            <AssignCard
              key={item.id}
              item={item}
              overdue={isOverdue(item, today)}
              selected={selectedIds.includes(item.id)}
              disabled={disabled}
              onToggleSelect={() => onToggleSelect(item.id)}
              onOpen={() => onOpenItem(item.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}

function AssignCard({
  item,
  overdue,
  selected,
  disabled,
  onToggleSelect,
  onOpen,
}: {
  item: OwnershipPanelWorkItem
  overdue: boolean
  selected: boolean
  disabled: boolean
  onToggleSelect: () => void
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardId(item.id),
    disabled,
  })

  return (
    <article
      ref={setNodeRef}
      className={cn(
        'rounded-xl border bg-card px-2 py-2 shadow-sm transition-opacity',
        selected ? 'border-sky-300 ring-1 ring-sky-200' : 'border-border/60',
        isDragging && 'opacity-40',
        overdue && 'border-rose-200/80',
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to assign"
          disabled={disabled}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px]">
              {item.type}
            </Badge>
            {overdue ? (
              <Badge
                variant="outline"
                className="rounded-full border-rose-200 bg-rose-50 px-1.5 py-0 text-[10px] text-rose-700"
              >
                Overdue
              </Badge>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-1 block w-full text-left text-xs font-semibold text-foreground hover:underline"
            onClick={onOpen}
          >
            {item.title}
          </button>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {item.status} · {item.dueDate?.slice(0, 10) || 'No due'}
          </p>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                selected
                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
              disabled={disabled}
              onClick={onToggleSelect}
            >
              {selected ? 'Selected' : 'Select'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
