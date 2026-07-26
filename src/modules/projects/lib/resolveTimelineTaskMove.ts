import type { WorkItemApiModel } from '@/lib/api/workApi'
import {
  directorySiblingScopeKey,
  reorderDirectoryFlatRowIds,
  resolveWorkItemParentIdForOrder,
  type DirectorySiblingOrderMap,
} from '@/modules/task-work-management/utils/directorySiblingOrder'
import {
  resolveWorkItemParentId,
  validateWorkItemMoveToRoot,
  validateWorkItemReparent,
  type WorkItemReparentValidationResult,
} from '@/modules/task-work-management/lib/workItemTreeValidation'
import { isSyntheticGanttSummaryId } from '@/modules/task-work-management/components/DirectoryGanttGridCells'

export type TimelineTaskMoveMode = 'before' | 'after' | 'up' | 'down' | 'child'

export type TimelineTaskMoveEvent = {
  id: string
  target?: string
  mode: TimelineTaskMoveMode
  inProgress?: boolean
}

export type ResolvedTimelineTaskMove = {
  valid: boolean
  message: string
  draggedId: string
  targetId: string | null
  mode: TimelineTaskMoveMode
  newParentId: string | null
  previousParentId: string | null
  parentChanged: boolean
  siblingOrder: DirectorySiblingOrderMap
}

function siblingIdsForParent(items: WorkItemApiModel[], parentId: string | null): string[] {
  const itemIds = new Set(items.map((item) => item.id))
  return items
    .filter((item) => resolveWorkItemParentIdForOrder(item, itemIds) === parentId)
    .map((item) => item.id)
}

function resolveInsertSide(mode: TimelineTaskMoveMode): 'before' | 'after' {
  return mode === 'before' || mode === 'up' ? 'before' : 'after'
}

function resolveNewParentId(
  items: WorkItemApiModel[],
  draggedId: string,
  targetId: string,
  mode: TimelineTaskMoveMode,
): { parentId: string | null; validation: WorkItemReparentValidationResult } {
  const itemIds = new Set(items.map((item) => item.id))
  const target = items.find((item) => item.id === targetId)
  if (!target) {
    return {
      parentId: null,
      validation: { valid: false, code: 'same_item', message: 'Drop target not found.' },
    }
  }

  if (mode === 'child') {
    return {
      parentId: targetId,
      validation: validateWorkItemReparent(draggedId, targetId, items),
    }
  }

  const targetParentId = resolveWorkItemParentId(target, itemIds)
  if (!targetParentId) {
    return {
      parentId: null,
      validation: validateWorkItemMoveToRoot(draggedId, items),
    }
  }

  return {
    parentId: targetParentId,
    validation: validateWorkItemReparent(draggedId, targetParentId, items),
  }
}

export function resolveTimelineTaskMove(
  event: TimelineTaskMoveEvent,
  items: WorkItemApiModel[],
  siblingOrder: DirectorySiblingOrderMap,
): ResolvedTimelineTaskMove | null {
  const draggedId = String(event.id)
  if (isSyntheticGanttSummaryId(draggedId)) return null

  const dragged = items.find((item) => item.id === draggedId)
  if (!dragged) return null

  const targetId = event.target ? String(event.target) : null
  if (!targetId || isSyntheticGanttSummaryId(targetId)) {
    return {
      valid: false,
      message: 'Drop target is not a movable work item.',
      draggedId,
      targetId,
      mode: event.mode,
      newParentId: null,
      previousParentId: null,
      parentChanged: false,
      siblingOrder,
    }
  }

  const itemIds = new Set(items.map((item) => item.id))
  const previousParentId = resolveWorkItemParentId(dragged, itemIds)
  const { parentId: newParentId, validation } = resolveNewParentId(items, draggedId, targetId, event.mode)
  if (!validation.valid || newParentId === undefined) {
    return {
      valid: false,
      message: validation.message,
      draggedId,
      targetId,
      mode: event.mode,
      newParentId: previousParentId,
      previousParentId,
      parentChanged: false,
      siblingOrder,
    }
  }

  const parentChanged = previousParentId !== newParentId
  const scopeKey = directorySiblingScopeKey(newParentId, null)
  const currentSiblingIds = siblingIdsForParent(items, newParentId)
  const existingOrder = siblingOrder[scopeKey]?.filter((id) => currentSiblingIds.includes(id)) ?? currentSiblingIds
  const normalizedOrder =
    existingOrder.length === currentSiblingIds.length
      ? existingOrder
      : [
          ...existingOrder,
          ...currentSiblingIds.filter((id) => !existingOrder.includes(id)),
        ]

  const side = event.mode === 'child' ? 'after' : resolveInsertSide(event.mode)
  let nextSiblingIds: string[] | null = null

  if (event.mode === 'child') {
    const scopedIds = normalizedOrder.filter((id) => id !== draggedId)
    nextSiblingIds = [...scopedIds, draggedId]
  } else {
    nextSiblingIds = reorderDirectoryFlatRowIds(normalizedOrder, draggedId, targetId, side)
  }

  const siblingOrderNext: DirectorySiblingOrderMap = nextSiblingIds
    ? { ...siblingOrder, [scopeKey]: nextSiblingIds }
    : siblingOrder

  return {
    valid: true,
    message: '',
    draggedId,
    targetId,
    mode: event.mode,
    newParentId,
    previousParentId,
    parentChanged,
    siblingOrder: siblingOrderNext,
  }
}

export function applyReparentToWorkItem(
  child: WorkItemApiModel,
  newParent: WorkItemApiModel | null,
): WorkItemApiModel {
  if (!newParent) {
    return {
      ...child,
      parentId: null,
      epicId: child.type === 'Epic' ? child.id : null,
      featureId: null,
    }
  }

  return {
    ...child,
    parentId: newParent.id,
    epicId: newParent.type === 'Epic' ? newParent.id : newParent.epicId ?? child.epicId ?? null,
    featureId: newParent.type === 'Feature' ? newParent.id : newParent.featureId ?? null,
  }
}
