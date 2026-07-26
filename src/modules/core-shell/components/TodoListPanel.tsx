import { useState, useEffect, useCallback, useMemo, Fragment, useContext } from 'react'
import {
  Plus,
  Loader2,
  Trash2,
  Circle,
  CheckCircle2,
  GripVertical,
  Calendar,
  CalendarOff,
  Flag,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Tag,
  ListTodo,
  Signal,
  Search,
} from 'lucide-react'
import {
  fetchTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  TECTONA_TODO_APP_ID,
  TODO_PRIORITY_IDS,
  TODO_CATEGORY_IDS,
  buildTodoEntityLinks,
  type TodoItem,
  type TodoPriorityCode,
} from '@/lib/api/todoApi'
import { notifyEvent } from '@/lib/api/notificationApi'
import { useSettingsPanelStore } from '@/stores/settings-panel-store'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetContext,
} from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { InlineCalendar } from '@/components/ui/inline-calendar'
import { DatePicker } from '@/components/ui/date-picker'

type FilterType = 'active' | 'done'

const TODO_CATEGORIES = ['General', 'Work', 'Personal'] as const
type TodoCategory = (typeof TODO_CATEGORIES)[number]

function getCategoryFromDescription(description: string | null): TodoCategory {
  if (!description?.trim()) return 'General'
  const match = description.match(/^\[([^\]]+)\]\s*/)
  return (match && TODO_CATEGORIES.includes(match[1] as TodoCategory)) ? (match[1] as TodoCategory) : 'General'
}

function getDescriptionBody(description: string | null): string {
  if (!description?.trim()) return ''
  const match = description.match(/^\[[^\]]+\]\s*/)
  return match ? description.slice(match[0].length) : description
}

function descriptionWithCategory(category: TodoCategory, body: string): string {
  if (category === 'General') return body.trim()
  return `[${category}]\n${body.trim()}`
}

function formatDueDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

/** Category display + background only when todo has category from API. No category = no label, default card style. */
function getTodoCategoryInfo(todo: TodoItem): { name: string; bgColor: string; textColor: string } | null {
  const first = todo.categories?.[0]
  if (!first) return null
  const name = first.name || (first.code === 'personal' ? 'Personal' : first.code === 'work' ? 'Work' : 'General')
  const hex = (first.color && first.color.startsWith('#')) ? first.color : (first.code === 'personal' ? '#3498db' : first.code === 'work' ? '#e67e22' : '#95a5a6')
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return {
    name,
    bgColor: `rgba(${r},${g},${b},0.14)`,
    textColor: hex,
  }
}

function getPriorityCode(todo: TodoItem): TodoPriorityCode | null {
  const code = todo.priorities?.[0]?.priority_code
  if (code === 'low' || code === 'medium' || code === 'high') return code
  return null
}

function PriorityBadge({ code }: { code: TodoPriorityCode }) {
  const label = code === 'low' ? 'Low' : code === 'medium' ? 'Medium' : 'High'
  const style =
    code === 'high'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-500/20'
      : code === 'medium'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20'
        : 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-500/20'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', style)}>
      {label}
    </span>
  )
}

function getPriorityConfig(code: TodoPriorityCode | null) {
  if (code === 'low') return { label: 'Low', dotColor: 'bg-green-500' }
  if (code === 'medium') return { label: 'Medium', dotColor: 'bg-amber-500' }
  if (code === 'high') return { label: 'High', dotColor: 'bg-red-500' }
  return { label: 'Priority', dotColor: '' }
}

function todoStatusTagChrome(active: boolean): string {
  const base =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold shadow-sm transition-all select-none'
  const off =
    'border-slate-200/70 bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700/80'
  const on =
    'border-primary/35 bg-primary/12 text-primary shadow-[0_4px_12px_rgba(37,99,235,0.22)] hover:bg-primary/16 dark:border-primary/50 dark:bg-primary/20 dark:text-blue-100 dark:shadow-[0_4px_12px_rgba(59,130,246,0.35)]'
  return cn(base, active ? on : off)
}

/** Flag icon: tries custom image from public/images/icon/ or images/icons/, falls back to Lucide Flag if image fails. */
function FlagIcon({ className }: { className?: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const srcs = ['/images/icon/icon-flag.png', '/images/icons/icon-flag.png']
  const [srcIndex, setSrcIndex] = useState(0)
  const src = srcs[srcIndex]
  const handleError = () => {
    if (srcIndex < srcs.length - 1) setSrcIndex((i) => i + 1)
    else setUseFallback(true)
  }
  if (useFallback) {
    return <Flag className={cn('shrink-0', className)} strokeWidth={2.5} />
  }
  return (
    <img
      src={src}
      alt=""
      className={cn('object-contain shrink-0', className)}
      onError={handleError}
    />
  )
}

function BottomSheetCancelButton() {
  const ctx = useContext(BottomSheetContext)
  return (
    <Button
      variant="ghost"
      className="text-slate-600 dark:text-slate-400 hover:text-foreground min-w-0"
      onClick={() => ctx?.setOpen(false)}
    >
      Cancel
    </Button>
  )
}

function SortableTodoRow({
  todo,
  isSelected,
  onSelectRow,
  onToggleComplete,
  onSetStatus,
  onOpenDueDate,
  onDelete,
  onContextMenu: onContextMenuProp,
  togglingId,
  deletingId,
  getTodoTooltipContent,
}: {
  todo: TodoItem
  isSelected: boolean
  onSelectRow: (todo: TodoItem, e: React.MouseEvent) => void
  onToggleComplete: (todo: TodoItem) => void
  onSetStatus: (todo: TodoItem, isCompleted: boolean) => void
  onOpenDueDate?: (todo: TodoItem) => void
  onDelete: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, todo: TodoItem) => void
  togglingId: string | null
  deletingId: string | null
  getTodoTooltipContent: (todo: TodoItem) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id })
  const style = transform ? { transform: CSS.Transform.toString(transform), transition } : undefined
  const priority = getPriorityCode(todo)
  const categoryInfo = getTodoCategoryInfo(todo)

  return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          ...(!isSelected && categoryInfo
            ? { backgroundColor: categoryInfo.bgColor, borderColor: categoryInfo.textColor }
            : undefined),
        }}
        data-todo-row
        className={cn(
          'group flex items-center gap-3 rounded-xl border shadow-sm hover:shadow-md transition-shadow px-4 py-3 cursor-pointer select-none',
          !categoryInfo && 'bg-white dark:bg-slate-800/50',
          todo.is_completed && 'opacity-70',
          isDragging && 'opacity-90 shadow-lg z-10 ring-2 ring-primary/20',
          isSelected
            ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10'
            : !categoryInfo && 'border-slate-200/80 dark:border-slate-700/50'
        )}
        onClick={(e) => onSelectRow(todo, e)}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenuProp?.(e, todo)
        }}
      >
      <div
        className="touch-none cursor-grab active:cursor-grabbing shrink-0 text-slate-400 opacity-40 group-hover:opacity-70 transition-opacity p-0.5 -m-0.5"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <button
        type="button"
        className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
        onClick={() => onToggleComplete(todo)}
        disabled={togglingId === todo.id}
        aria-label={todo.is_completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {togglingId === todo.id ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : todo.is_completed ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Tooltip content={getTodoTooltipContent(todo)} side="top">
          <span
            className={cn(
              'text-sm font-medium text-slate-800 dark:text-slate-200 truncate inline-block min-w-0 max-w-full',
              todo.is_completed && 'line-through text-slate-500 dark:text-slate-400'
            )}
          >
            {todo.title}
          </span>
        </Tooltip>
        <div className="flex items-center gap-2 flex-wrap">
          {todo.is_flagged && (
            <span className="inline-flex items-center shrink-0" aria-label="Flagged" title="Flagged">
              <FlagIcon className="h-3.5 w-3.5 text-red-500" />
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                disabled={togglingId === todo.id}
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:opacity-90 disabled:opacity-50',
                  todo.is_completed
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gradient-to-r from-blue-500/15 to-indigo-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-500/20'
                )}
                aria-label="Change status"
              >
                {togglingId === todo.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  todo.is_completed ? 'Done' : 'In Progress'
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onSetStatus(todo, false)}>
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetStatus(todo, true)}>
                Done
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {priority && <PriorityBadge code={priority} />}
          {!todo.is_completed && !todo.due_date && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenDueDate?.(todo) }}
              className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:text-primary transition-colors rounded p-0.5 -m-0.5"
              title="Set due date"
              aria-label="Set due date"
            >
              <CalendarOff className="h-3 w-3 shrink-0" />
            </button>
          )}
          {todo.due_date && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDueDate(todo.due_date)}
            </span>
          )}
          {categoryInfo && (
            <span
              className="inline-flex items-center text-[11px] font-medium rounded-md px-1.5 py-0.5 lowercase ml-auto"
              style={{ color: categoryInfo.textColor }}
            >
              #{categoryInfo.name.toLowerCase()}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
        onClick={() => onDelete(todo.id)}
        disabled={deletingId === todo.id}
        aria-label="Delete todo"
      >
        {deletingId === todo.id ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}

interface TodoListPanelProps {
  /** When set, edit bottom sheet is portaled into this element (drawer) instead of viewport */
  panelContainerEl?: HTMLElement | null
}

export function TodoListPanel({ panelContainerEl }: TodoListPanelProps = {}) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newPriority, setNewPriority] = useState<TodoPriorityCode | null>(null)
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [filter, setFilter] = useState<FilterType>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; todo: TodoItem } | null>(null)
  const [editDialog, setEditDialog] = useState<{ todo: TodoItem; field: 'title' | 'due_date' | 'category' } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { todoContext, clearTodoContext } = useSettingsPanelStore()

  const loadTodos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchTodos({
        app_id: TECTONA_TODO_APP_ID,
        page: 1,
        page_size: 100,
      })
      const sorted = [...(res.todos || [])].sort((a, b) => a.display_order - b.display_order)
      setTodos(sorted)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load todos'
      const isNetworkError = msg === 'Failed to fetch' || msg.toLowerCase().includes('network')
      setError(isNetworkError ? 'Tidak dapat terhubung ke Todo service. Pastikan backend Todo berjalan (port 8650) dan database tersedia.' : msg)
      setTodos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  useEffect(() => {
    if (todoContext?.projectName) {
      setNewTitle((prev) => (prev ? prev : `Todo for ${todoContext.projectName}`))
      clearTodoContext()
    }
  }, [todoContext, clearTodoContext])

  const filteredTodos = useMemo(() => {
    let list = todos
    if (filter === 'active') list = list.filter((t) => !t.is_completed)
    else list = list.filter((t) => t.is_completed)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((t) => {
        const title = (t.title ?? '').toLowerCase()
        const desc = (getDescriptionBody(t.description) ?? '').toLowerCase()
        return title.includes(q) || desc.includes(q)
      })
    }
    return list
  }, [todos, filter, searchQuery])

  type DueSection = 'overdue' | 'today' | 'tomorrow' | 'other'
  const todosByDueSection = useMemo(() => {
    const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const now = new Date()
    const todayStart = toDateOnly(now)
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000

    const groups: Record<DueSection, TodoItem[]> = { overdue: [], today: [], tomorrow: [], other: [] }
    for (const t of filteredTodos) {
      if (!t.due_date) {
        groups.other.push(t)
        continue
      }
      const due = new Date(t.due_date)
      const dueStart = toDateOnly(due)
      if (dueStart < todayStart) groups.overdue.push(t)
      else if (dueStart === todayStart) groups.today.push(t)
      else if (dueStart === tomorrowStart) groups.tomorrow.push(t)
      else groups.other.push(t)
    }
    return groups
  }, [filteredTodos])

  const totalCount = todos.length
  const doneCount = useMemo(() => todos.filter((t) => t.is_completed).length, [todos])
  const activeCount = useMemo(() => totalCount - doneCount, [totalCount, doneCount])

  const sectionLabels: { key: DueSection; label: string }[] = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'other', label: 'Unscheduled' },
  ]

  const orderedTodoIds = useMemo(
    () => sectionLabels.flatMap(({ key }) => todosByDueSection[key].map((t) => t.id)),
    [todosByDueSection]
  )

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title || adding) return
    setAdding(true)
    try {
      await createTodo({
        title,
        app_id: TECTONA_TODO_APP_ID,
        due_date: newDueDate || null,
        priority_ids: newPriority ? [TODO_PRIORITY_IDS[newPriority]] : null,
        display_order: todos.length,
        entity_links: buildTodoEntityLinks(todoContext?.projectId ? { projectId: todoContext.projectId } : null),
      })
      notifyEvent({ type_code: 'todo', title: `Todo: ${title}`, body: 'Added to your list' })
      setNewTitle('')
      setNewDueDate('')
      setNewPriority(null)
      window.dispatchEvent(new CustomEvent('tectona-todos-changed'))
      await loadTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add todo')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (todo: TodoItem) => {
    if (togglingId) return
    setTogglingId(todo.id)
    try {
      await updateTodo(todo.id, { is_completed: !todo.is_completed })
      notifyEvent({
        type_code: 'todo',
        title: todo.is_completed ? `Todo aktif: ${todo.title}` : `Todo selesai: ${todo.title}`,
        body: todo.is_completed ? 'Ditandai belum selesai' : 'Ditandai selesai',
      })
      await loadTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleSetStatus = async (todo: TodoItem, isCompleted: boolean) => {
    if (togglingId) return
    if (todo.is_completed === isCompleted) return
    setTogglingId(todo.id)
    try {
      await updateTodo(todo.id, { is_completed: isCompleted })
      notifyEvent({
        type_code: 'todo',
        title: isCompleted ? `Todo selesai: ${todo.title}` : `Todo aktif: ${todo.title}`,
        body: isCompleted ? 'Ditandai selesai' : 'Ditandai belum selesai',
      })
      await loadTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleSelectRow = useCallback(
    (todo: TodoItem, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, input, [role="button"], a')) return
      const id = todo.id
      if (e.shiftKey) {
        const idx = orderedTodoIds.indexOf(id)
        const anchorIdx = anchorId != null ? orderedTodoIds.indexOf(anchorId) : -1
        if (anchorIdx === -1) {
          setSelectedIds((s) => new Set(s).add(id))
          setAnchorId(id)
          return
        }
        const start = Math.min(anchorIdx, idx)
        const end = Math.max(anchorIdx, idx)
        const rangeIds = orderedTodoIds.slice(start, end + 1)
        setSelectedIds((s) => {
          const next = new Set(s)
          rangeIds.forEach((i) => next.add(i))
          return next
        })
      } else if (e.ctrlKey || e.metaKey) {
        setSelectedIds((s) => {
          const next = new Set(s)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        setAnchorId(id)
      } else {
        if (selectedIds.has(id)) {
          setSelectedIds(new Set())
          setAnchorId(null)
        } else {
          setSelectedIds(new Set([id]))
          setAnchorId(id)
        }
      }
    },
    [orderedTodoIds, anchorId, selectedIds]
  )

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      const n = selectedIds.size
      await Promise.all(Array.from(selectedIds).map((id) => deleteTodo(id)))
      notifyEvent({
        type_code: 'todo',
        title: n === 1 ? 'Todo dihapus' : `${n} todo dihapus`,
        body: n === 1 ? '1 todo telah dihapus dari daftar' : `${n} todo telah dihapus dari daftar`,
      })
      setSelectedIds(new Set())
      setAnchorId(null)
      window.dispatchEvent(new CustomEvent('tectona-todos-changed'))
      await loadTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete selected todos')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (deletingId) return
    const todo = todos.find((t) => t.id === id)
    setDeletingId(id)
    try {
      await deleteTodo(id)
      if (todo) {
        notifyEvent({ type_code: 'todo', title: `Todo dihapus: ${todo.title}`, body: 'Telah dihapus dari daftar' })
      }
      setSelectedIds((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
      if (anchorId === id) setAnchorId(null)
      window.dispatchEvent(new CustomEvent('tectona-todos-changed'))
      await loadTodos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete todo')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = todos.findIndex((t) => t.id === active.id)
      const newIndex = todos.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(todos, oldIndex, newIndex)
      setTodos(reordered)
      try {
        for (let i = 0; i < reordered.length; i++) {
          const t = reordered[i]
          if (t.display_order !== i) {
            await updateTodo(t.id, { display_order: i })
          }
        }
        await loadTodos()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reorder')
        await loadTodos()
      }
    },
    [todos, loadTodos]
  )

  const openContextMenu = useCallback((e: React.MouseEvent, todo: TodoItem) => {
    setContextMenu({ x: e.clientX, y: e.clientY, todo })
  }, [])

  const openEditTodo = useCallback(() => {
    if (!contextMenu) return
    setEditDialog({ todo: contextMenu.todo, field: 'title' })
    setEditValue(contextMenu.todo.title ?? '')
    setContextMenu(null)
  }, [contextMenu])

  const openEditDueDate = useCallback(() => {
    if (!contextMenu) return
    const d = contextMenu.todo.due_date
    setEditDialog({ todo: contextMenu.todo, field: 'due_date' })
    setEditValue(d ? new Date(d).toISOString().slice(0, 10) : '')
    setContextMenu(null)
  }, [contextMenu])

  const openDueDateForTodo = useCallback((todo: TodoItem) => {
    const d = todo.due_date
    setEditDialog({ todo, field: 'due_date' })
    setEditValue(d ? new Date(d).toISOString().slice(0, 10) : '')
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editDialog) return
    setUpdatingId(editDialog.todo.id)
    try {
      if (editDialog.field === 'title') {
        await updateTodo(editDialog.todo.id, { title: (editValue || '').trim() || editDialog.todo.title })
        notifyEvent({ type_code: 'todo', title: `Todo diubah: ${(editValue || '').trim() || editDialog.todo.title}`, body: 'Judul diperbarui' })
      } else if (editDialog.field === 'due_date') {
        await updateTodo(editDialog.todo.id, { due_date: editValue || null })
        notifyEvent({ type_code: 'todo', title: `Todo diperbarui: ${editDialog.todo.title}`, body: editValue ? `Batas waktu: ${editValue}` : 'Batas waktu dihapus' })
      } else if (editDialog.field === 'category') {
        const body = getDescriptionBody(editDialog.todo.description)
        const newDesc = descriptionWithCategory(editValue as TodoCategory, body)
        await updateTodo(editDialog.todo.id, { description: newDesc || null })
        notifyEvent({ type_code: 'todo', title: `Todo diperbarui: ${editDialog.todo.title}`, body: `Kategori: ${editValue}` })
      }
      await loadTodos()
      setEditDialog(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setUpdatingId(null)
    }
  }, [editDialog, editValue, loadTodos])

  const handlePrioritySelect = useCallback(
    async (todo: TodoItem, code: TodoPriorityCode) => {
      setContextMenu(null)
      setUpdatingId(todo.id)
      try {
        await updateTodo(todo.id, { priority_ids: [TODO_PRIORITY_IDS[code]] })
        notifyEvent({ type_code: 'todo', title: `Prioritas diubah: ${todo.title}`, body: `Prioritas: ${code}` })
        await loadTodos()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update priority')
      } finally {
        setUpdatingId(null)
      }
    },
    [loadTodos]
  )

  const handleStatusSelect = useCallback(
    async (todo: TodoItem, isCompleted: boolean) => {
      setContextMenu(null)
      setUpdatingId(todo.id)
      try {
        await updateTodo(todo.id, { is_completed: isCompleted })
        notifyEvent({
          type_code: 'todo',
          title: isCompleted ? `Todo selesai: ${todo.title}` : `Todo aktif: ${todo.title}`,
          body: isCompleted ? 'Ditandai selesai' : 'Ditandai belum selesai',
        })
        await loadTodos()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status')
      } finally {
        setUpdatingId(null)
      }
    },
    [loadTodos]
  )

  const handleCategorySelect = useCallback(
    async (todo: TodoItem, category: TodoCategory) => {
      setContextMenu(null)
      setUpdatingId(todo.id)
      try {
        const categoryId = TODO_CATEGORY_IDS[category]
        const category_ids = categoryId ? [categoryId] : []
        await updateTodo(todo.id, { category_ids })
        notifyEvent({ type_code: 'todo', title: `Todo diperbarui: ${todo.title}`, body: `Kategori: ${category}` })
        await loadTodos()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update category')
      } finally {
        setUpdatingId(null)
      }
    },
    [loadTodos]
  )

  const handleToggleFlag = useCallback(
    async (todo: TodoItem) => {
      setContextMenu(null)
      setUpdatingId(todo.id)
      try {
        await updateTodo(todo.id, { is_flagged: !todo.is_flagged })
        notifyEvent({
          type_code: 'todo',
          title: todo.is_flagged ? `Todo unflagged: ${todo.title}` : `Todo ditandai: ${todo.title}`,
          body: todo.is_flagged ? 'Tanda penting dihapus' : 'Ditandai penting',
        })
        await loadTodos()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update flag')
      } finally {
        setUpdatingId(null)
      }
    },
    [loadTodos]
  )

  const getTodoTooltipParts = useCallback((todo: TodoItem): string[] => {
    const parts: string[] = [todo.title]
    const body = getDescriptionBody(todo.description)
    if (body.trim()) parts.push(body.trim())
    if (todo.due_date) {
      try {
        const d = new Date(todo.due_date)
        parts.push(`Due: ${d.toLocaleDateString('en-US')}`)
      } catch {
        parts.push(`Due: ${todo.due_date}`)
      }
    }
    if (todo.completed_at) {
      try {
        const d = new Date(todo.completed_at)
        parts.push(`Completed: ${d.toLocaleDateString('en-US')} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`)
      } catch {
        parts.push(`Completed: ${todo.completed_at}`)
      }
    }
    return parts
  }, [])

  const getTodoTooltip = useCallback((todo: TodoItem) => getTodoTooltipParts(todo).join('\n'), [getTodoTooltipParts])

  const getTodoTooltipContent = useCallback(
    (todo: TodoItem) => {
      const parts = getTodoTooltipParts(todo)
      return (
        <div className="space-y-1.5 text-[13px] font-normal text-slate-700 dark:text-slate-300 leading-relaxed">
          {parts.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )
    },
    [getTodoTooltipParts]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handlePanelClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectedIds.size === 0) return
      const target = e.target as HTMLElement
      if (target.closest('[data-todo-row]') || target.closest('[data-bulk-actions]')) return
      setSelectedIds(new Set())
      setAnchorId(null)
    },
    [selectedIds.size]
  )

  return (
    <div className="relative flex flex-col gap-6 min-h-full px-5" onClick={handlePanelClick}>
      {/* Context menu for todo row (right-click). Use same position logic as ContextMenu so arrow is correct on first open. */}
      {contextMenu && (() => {
        const menuWidth = 224
        const submenuWidth = 136
        const padding = 8
        let actualMenuX = contextMenu.x
        if (contextMenu.x + menuWidth > window.innerWidth - padding) {
          actualMenuX = window.innerWidth - menuWidth - padding
        }
        if (actualMenuX < padding) actualMenuX = padding
        const submenuOpensLeft = actualMenuX + menuWidth + submenuWidth > window.innerWidth - padding
        return (
          <ContextMenu
            open={!!contextMenu}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          >
            <ContextMenuItem
              onSelect={openEditTodo}
            >
              <FileText className="w-4 h-4 mr-2" />
              Change todo
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={openEditDueDate}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Change target date
            </ContextMenuItem>
            <ContextMenuSubmenu
              trigger={
                <>
                  {submenuOpensLeft && <ChevronLeft className="w-4 h-4 mr-2 shrink-0" />}
                  <Tag className="w-4 h-4 mr-2" />
                  Change category
                  {!submenuOpensLeft && <ChevronRight className="w-4 h-4 ml-auto shrink-0" />}
                </>
              }
            >
              {TODO_CATEGORIES.map((cat) => (
                <ContextMenuItem
                  key={cat}
                  onSelect={() => handleCategorySelect(contextMenu.todo, cat)}
                >
                  {cat}
                </ContextMenuItem>
              ))}
            </ContextMenuSubmenu>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => handleToggleFlag(contextMenu.todo)}>
              <FlagIcon className="w-4 h-4 mr-2 shrink-0" />
              {contextMenu.todo.is_flagged ? 'Remove Flag' : 'Add Flag'}
            </ContextMenuItem>
            <ContextMenuSubmenu
              trigger={
                <>
                  {submenuOpensLeft && <ChevronLeft className="w-4 h-4 mr-2 shrink-0" />}
                  <Signal className="w-4 h-4 mr-2 shrink-0" />
                  Change priority
                  {!submenuOpensLeft && <ChevronRight className="w-4 h-4 ml-auto shrink-0" />}
                </>
              }
            >
              {(['low', 'medium', 'high'] as const).map((code) => (
                <ContextMenuItem
                  key={code}
                  onSelect={() => handlePrioritySelect(contextMenu.todo, code)}
                >
                  {code === 'low' ? 'Low' : code === 'medium' ? 'Medium' : 'High'}
                </ContextMenuItem>
              ))}
            </ContextMenuSubmenu>
            <ContextMenuSubmenu
              trigger={
                <>
                  {submenuOpensLeft && <ChevronLeft className="w-4 h-4 mr-2 shrink-0" />}
                  <ListTodo className="w-4 h-4 mr-2" />
                  Change status
                  {!submenuOpensLeft && <ChevronRight className="w-4 h-4 ml-auto shrink-0" />}
                </>
              }
            >
              <ContextMenuItem onSelect={() => handleStatusSelect(contextMenu.todo, false)}>
                In Progress
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => handleStatusSelect(contextMenu.todo, true)}>
                Done
              </ContextMenuItem>
            </ContextMenuSubmenu>
          </ContextMenu>
        )
      })()}

      {/* Edit bottom sheet — inside drawer when panelContainerEl set, glassmorphism, slide-up, swipe to close */}
      <BottomSheet
        open={!!editDialog}
        onOpenChange={(open) => !open && setEditDialog(null)}
        swipeToClose
        containerEl={panelContainerEl}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>
            {editDialog?.field === 'title' && 'Change todo'}
            {editDialog?.field === 'due_date' && 'Change target date'}
            {editDialog?.field === 'category' && 'Change category'}
          </BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetContent>
          {editDialog?.field === 'title' && (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full min-h-[100px] rounded-2xl border border-slate-200/80 dark:border-slate-600/80 bg-white/80 dark:bg-slate-800/80 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400/50 transition-shadow resize-y"
              placeholder="Todo title..."
              rows={4}
            />
          )}
          {editDialog?.field === 'due_date' && (
            <InlineCalendar
              value={editValue || null}
              onChange={(v) => setEditValue(v ?? '')}
              defaultExpanded={false}
            />
          )}
          {editDialog?.field === 'category' && (
            <div className="flex flex-wrap gap-2">
              {TODO_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setEditValue(cat)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    editValue === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </BottomSheetContent>
        <BottomSheetFooter>
          <BottomSheetCancelButton />
          <Button
            onClick={handleSaveEdit}
            disabled={updatingId === editDialog?.todo.id}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            {updatingId === editDialog?.todo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Add new — elegant input + floating add with glow */}
      <div
        className={cn(
          'glass-card rounded-2xl p-4 space-y-4',
          'border border-white/40 dark:border-white/10',
          'ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
          'shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.35)]',
          'bg-gradient-to-br from-white/70 via-background/75 to-slate-50/70 dark:from-slate-900/45 dark:via-background/40 dark:to-slate-950/20'
        )}
      >
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Add todo..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 rounded-xl border border-slate-200/80 dark:border-slate-600/50 bg-white dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-shadow"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newTitle.trim() || adding}
            className="shrink-0 h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
            aria-label="Add todo"
          >
            {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>

        {/* Filter row: status pills + priority pill + date */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
            {(['active', 'done'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={todoStatusTagChrome(filter === f)}
                aria-pressed={filter === f}
                title={f === 'active' ? 'Show active todos' : 'Show completed todos'}
              >
                <span>{f === 'active' ? 'Active' : 'Done'}</span>
                <span className={cn('tabular-nums text-[10px]', filter === f ? 'opacity-80' : 'opacity-60')}>
                  {f === 'active' ? activeCount : doneCount}
                </span>
              </button>
            ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 min-w-0 max-w-[140px]">
              <DatePicker
                value={newDueDate || null}
                onChange={(value) => setNewDueDate(value || '')}
                placeholder="dd/mm/yyyy"
                className="w-full"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-600/50',
                    'bg-white dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-700 dark:text-slate-300',
                    'hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20'
                  )}
                >
                  {newPriority && (
                    <div className={cn('w-2 h-2 rounded-full shrink-0', getPriorityConfig(newPriority).dotColor)} />
                  )}
                  <span>{getPriorityConfig(newPriority).label}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[140px] rounded-[14px] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-600/50 shadow-md shadow-black/5 dark:shadow-black/15 py-1.5"
                align="end"
              >
                <DropdownMenuItem
                  onClick={() => setNewPriority(null)}
                  className={cn(
                    'px-3 py-2 text-xs font-normal text-slate-700 dark:text-slate-200',
                    'hover:!bg-blue-50/80 dark:hover:!bg-blue-500/10 transition-colors duration-150',
                    'mx-1 rounded-md',
                    !newPriority && 'bg-blue-50/50 dark:bg-blue-500/10'
                  )}
                >
                  Priority
                </DropdownMenuItem>
                {(['low', 'medium', 'high'] as const).map((code) => {
                  const config = getPriorityConfig(code)
                  return (
                    <DropdownMenuItem
                      key={code}
                      onClick={() => setNewPriority(code)}
                      className={cn(
                        'px-3 py-2 text-xs font-normal text-slate-700 dark:text-slate-200 flex items-center gap-2.5',
                        'hover:!bg-blue-50/80 dark:hover:!bg-blue-500/10 transition-colors duration-150',
                        'mx-1 rounded-md',
                        newPriority === code && 'bg-blue-50/50 dark:bg-blue-500/10'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full shrink-0', config.dotColor)} />
                      <span>{config.label}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap min-h-[2.25rem]" data-bulk-actions>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium shrink-0">
              {doneCount} / {totalCount}
            </span>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search todo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Search todos"
              />
            </div>
          </div>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 px-2">{error}</p>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-1 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <img
              src="/images/todo.png"
              alt="No todos"
              className="w-24 h-24 object-contain mb-4 opacity-80"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === 'active' ? 'No active todos.' : 'No completed todos.'}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {sectionLabels.map(({ key, label }) => {
                const items = todosByDueSection[key]
                if (items.length === 0) return null
                return (
                  <Fragment key={key}>
                    <div
                      className={cn(
                        'sticky top-0 z-[1] flex items-center gap-3 py-3 first:pt-1 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-slate-900/80 dark:to-slate-900 backdrop-blur-sm',
                        key === 'overdue' && 'text-red-600 dark:text-red-400',
                        key === 'today' && 'text-primary',
                        (key === 'tomorrow' || key === 'other') && 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest text-current">
                        {label}
                      </span>
                      <span className="flex-1 h-px bg-slate-200/80 dark:bg-slate-600/50" aria-hidden />
                    </div>
                    <div className="space-y-2">
                      {items.map((todo) => (
                        <SortableTodoRow
                          key={todo.id}
                          todo={todo}
                          isSelected={selectedIds.has(todo.id)}
                          onSelectRow={handleSelectRow}
                          onToggleComplete={handleToggle}
                          onSetStatus={handleSetStatus}
                          onOpenDueDate={openDueDateForTodo}
                          onDelete={handleDelete}
                          onContextMenu={openContextMenu}
                          togglingId={togglingId}
                          deletingId={deletingId}
                          getTodoTooltipContent={getTodoTooltipContent}
                        />
                      ))}
                    </div>
                  </Fragment>
                )
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
