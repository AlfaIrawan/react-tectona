import type { WorkItemType } from '@/lib/api/workApi'

export const WORK_ITEM_TREE_MAX_DEPTH = 6

export const WORK_ITEM_ALLOWED_CHILDREN: Record<WorkItemType, WorkItemType[]> = {
  Epic: ['Feature'],
  Feature: ['Task'],
  Task: ['Subtask', 'Checklist'],
  Subtask: ['Subtask', 'Checklist'],
  Checklist: [],
  Bug: ['Subtask', 'Checklist'],
}

export const WORK_ITEM_ALLOWED_PARENTS: Record<WorkItemType, WorkItemType[]> = {
  Epic: [],
  Feature: ['Epic'],
  Bug: ['Epic', 'Feature'],
  Task: ['Epic', 'Feature'],
  Subtask: ['Task', 'Subtask'],
  Checklist: ['Task', 'Subtask'],
}

export type WorkItemTreeNode = {
  id: string
  type: WorkItemType
  parentId?: string | null
  epicId?: string | null
  featureId?: string | null
}

export type WorkItemReparentValidationCode =
  | 'valid'
  | 'same_item'
  | 'descendant_cycle'
  | 'max_depth'
  | 'child_cannot_reparent'
  | 'parent_cannot_have_children'
  | 'invalid_parent_child_types'
  | 'root_not_allowed'

export interface WorkItemReparentValidationResult {
  valid: boolean
  code: WorkItemReparentValidationCode
  message: string
}

function formatWorkItemTypes(types: WorkItemType[]): string {
  if (types.length === 0) return 'none (root level only)'
  return types.join(', ')
}

export function resolveWorkItemParentId(item: WorkItemTreeNode, itemIds: Set<string>): string | null {
  if (item.parentId && itemIds.has(item.parentId)) return item.parentId
  if (item.featureId && itemIds.has(item.featureId)) return item.featureId
  if (item.epicId && itemIds.has(item.epicId)) return item.epicId
  return null
}

export function collectWorkItemDescendantIds(rootId: string, items: WorkItemTreeNode[]): Set<string> {
  const itemIds = new Set(items.map((entry) => entry.id))
  const childrenByParent = new Map<string, string[]>()

  for (const item of items) {
    const parentId = resolveWorkItemParentId(item, itemIds)
    if (!parentId) continue
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(item.id)
    childrenByParent.set(parentId, siblings)
  }

  const descendants = new Set<string>()
  // Guards against a corrupted/cyclic parent chain turning this into an infinite loop.
  const walk = (id: string) => {
    for (const childId of childrenByParent.get(id) ?? []) {
      if (descendants.has(childId)) continue
      descendants.add(childId)
      walk(childId)
    }
  }
  walk(rootId)
  return descendants
}

function computeWorkItemDepth(itemId: string, items: WorkItemTreeNode[]): number {
  const itemMap = new Map(items.map((entry) => [entry.id, entry]))
  const itemIds = new Set(items.map((entry) => entry.id))
  const visited = new Set<string>()
  let depth = 0
  let current = itemMap.get(itemId)

  // `visited` guards against a corrupted/cyclic parent chain looping forever.
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const parentId = resolveWorkItemParentId(current, itemIds)
    if (!parentId) break
    depth += 1
    current = itemMap.get(parentId)
  }

  return depth
}

function getWorkItemSubtreeHeight(itemId: string, items: WorkItemTreeNode[]): number {
  const itemIds = new Set(items.map((entry) => entry.id))
  const childrenByParent = new Map<string, string[]>()

  for (const item of items) {
    const parentId = resolveWorkItemParentId(item, itemIds)
    if (!parentId) continue
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(item.id)
    childrenByParent.set(parentId, siblings)
  }

  // `ancestry` guards against a corrupted/cyclic parent chain recursing forever.
  const height = (id: string, ancestry: Set<string>): number => {
    const children = childrenByParent.get(id) ?? []
    if (children.length === 0 || ancestry.has(id)) return 1
    const nextAncestry = new Set(ancestry).add(id)
    return 1 + Math.max(...children.map((childId) => height(childId, nextAncestry)))
  }

  return height(itemId, new Set())
}

export function validateWorkItemMoveToRoot(
  childId: string,
  items: WorkItemTreeNode[],
): WorkItemReparentValidationResult {
  const child = items.find((entry) => entry.id === childId)
  if (!child) {
    return { valid: false, code: 'same_item', message: 'Work item not found.' }
  }

  if (WORK_ITEM_ALLOWED_PARENTS[child.type].length > 0) {
    return {
      valid: false,
      code: 'root_not_allowed',
      message: `${child.type} must remain under a parent. Allowed parents: ${formatWorkItemTypes(WORK_ITEM_ALLOWED_PARENTS[child.type])}.`,
    }
  }

  return { valid: true, code: 'valid', message: '' }
}

export function validateWorkItemReparent(
  draggedId: string,
  newParentId: string,
  items: WorkItemTreeNode[],
): WorkItemReparentValidationResult {
  const child = items.find((entry) => entry.id === draggedId)
  const parent = items.find((entry) => entry.id === newParentId)

  if (!child || !parent) {
    return { valid: false, code: 'same_item', message: 'Work item not found.' }
  }

  if (draggedId === newParentId) {
    return { valid: false, code: 'same_item', message: 'Cannot drop a work item onto itself.' }
  }

  if (collectWorkItemDescendantIds(draggedId, items).has(newParentId)) {
    return {
      valid: false,
      code: 'descendant_cycle',
      message: 'Cannot drop a work item onto its own descendant.',
    }
  }

  if (WORK_ITEM_ALLOWED_PARENTS[child.type].length === 0) {
    return {
      valid: false,
      code: 'child_cannot_reparent',
      message: `${child.type} cannot be nested under another item. ${child.type} must remain at root level.`,
    }
  }

  if (WORK_ITEM_ALLOWED_CHILDREN[parent.type].length === 0) {
    return {
      valid: false,
      code: 'parent_cannot_have_children',
      message: `${parent.type} cannot be a parent. Checklist items are always leaf nodes.`,
    }
  }

  if (!WORK_ITEM_ALLOWED_CHILDREN[parent.type].includes(child.type)) {
    return {
      valid: false,
      code: 'invalid_parent_child_types',
      message: `${child.type} cannot be a child of ${parent.type}. ${parent.type} may only contain: ${formatWorkItemTypes(WORK_ITEM_ALLOWED_CHILDREN[parent.type])}.`,
    }
  }

  if (!WORK_ITEM_ALLOWED_PARENTS[child.type].includes(parent.type)) {
    return {
      valid: false,
      code: 'invalid_parent_child_types',
      message: `${child.type} may only be placed under: ${formatWorkItemTypes(WORK_ITEM_ALLOWED_PARENTS[child.type])}.`,
    }
  }

  const parentDepth = computeWorkItemDepth(newParentId, items)
  const subtreeHeight = getWorkItemSubtreeHeight(draggedId, items)
  if (parentDepth + subtreeHeight > WORK_ITEM_TREE_MAX_DEPTH) {
    return {
      valid: false,
      code: 'max_depth',
      message: `Nesting limit reached (maximum ${WORK_ITEM_TREE_MAX_DEPTH} levels).`,
    }
  }

  return { valid: true, code: 'valid', message: '' }
}
