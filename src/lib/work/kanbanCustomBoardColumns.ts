import type { WorkStatus } from '@/lib/api/workApi'
import { WORK_STATUS_VALUES } from '@/lib/work/kanbanBoardColumnLabels'
import type { KanbanColumnColorPreset } from '@/lib/work/kanbanBoardColumnTheme'

export type KanbanBoardColumnId = WorkStatus | `custom:${string}`

export type KanbanCustomBoardColumn = {
  id: string
  label: string
}

export type KanbanBoardLayout = {
  customColumns: KanbanCustomBoardColumn[]
  columnSequence: KanbanBoardColumnId[]
  customColumnItems: Record<string, string[]>
  columnColors: Partial<Record<string, KanbanColumnColorPreset>>
}

export const KANBAN_CUSTOM_COLUMN_PREFIX = 'custom:'

const boardLayoutsMemory = new Map<string, KanbanBoardLayout>()

function defaultLayout(): KanbanBoardLayout {
  return {
    customColumns: [],
    columnSequence: [...WORK_STATUS_VALUES],
    customColumnItems: {},
    columnColors: {},
  }
}

export function isCustomBoardColumnId(id: KanbanBoardColumnId): id is `custom:${string}` {
  return id.startsWith(KANBAN_CUSTOM_COLUMN_PREFIX)
}

export function customBoardColumnKey(columnId: string): `custom:${string}` {
  return `${KANBAN_CUSTOM_COLUMN_PREFIX}${columnId}`
}

export function createCustomBoardColumn(label: string): KanbanCustomBoardColumn {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `col-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return { id, label: label.trim() || 'New board' }
}

export function loadKanbanBoardLayout(scope: string): KanbanBoardLayout {
  const cached = boardLayoutsMemory.get(scope)
  if (cached) {
    return {
      customColumns: [...cached.customColumns],
      columnSequence: [...cached.columnSequence],
      customColumnItems: { ...cached.customColumnItems },
      columnColors: { ...cached.columnColors },
    }
  }
  return defaultLayout()
}

export function persistKanbanBoardLayout(scope: string, layout: KanbanBoardLayout) {
  if (typeof window === 'undefined') return
  boardLayoutsMemory.set(scope, {
    customColumns: [...layout.customColumns],
    columnSequence: [...layout.columnSequence],
    customColumnItems: { ...layout.customColumnItems },
    columnColors: { ...layout.columnColors },
  })
  window.dispatchEvent(
    new CustomEvent('tectona:kanban-board-layout-changed', { detail: { scope } }),
  )
}

export function boardColumnSortableKey(columnId: KanbanBoardColumnId): string {
  return `kanban-board-column:${columnId}`
}

export function resolveBoardColumnIdFromSortable(sortableId: string): KanbanBoardColumnId | null {
  const prefix = 'kanban-board-column:'
  if (!sortableId.startsWith(prefix)) return null
  return sortableId.slice(prefix.length) as KanbanBoardColumnId
}
