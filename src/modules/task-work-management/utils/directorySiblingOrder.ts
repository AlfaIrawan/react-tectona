export type DirectorySiblingOrderMap = Record<string, string[]>

export type DirectoryOrderWorkItem = {
  id: string
  parentId?: string | null
  epicId?: string | null
  featureId?: string | null
}

export function directorySiblingScopeKey(parentId: string | null, groupLabel: string | null): string {
  return `${groupLabel ?? '__all__'}::${parentId ?? 'root'}`
}

/** Flat list view order (all visible rows), independent of tree parent/child level. */
export function resolveDirectoryFlatListScope(groupLabel: string | null): string {
  return `__flat__::${groupLabel ?? '__all__'}`
}

export function reorderDirectoryFlatRowIds(
  orderedIds: string[],
  activeId: string,
  overId: string,
  side: 'before' | 'after',
): string[] | null {
  const oldIndex = orderedIds.indexOf(activeId)
  const overIndex = orderedIds.indexOf(overId)
  if (oldIndex < 0 || overIndex < 0) return null

  let targetIndex = side === 'after' ? overIndex + 1 : overIndex
  if (oldIndex < targetIndex) targetIndex -= 1

  const withoutActive = orderedIds.filter((id) => id !== activeId)
  targetIndex = Math.max(0, Math.min(targetIndex, withoutActive.length))
  if (oldIndex === targetIndex) return null

  const next = [...withoutActive]
  next.splice(targetIndex, 0, activeId)
  return next
}

export function applyDirectoryFlatRowOrder<T extends { item: { id: string } }>(
  rows: T[],
  orderByScope: DirectorySiblingOrderMap,
  groupLabel: string | null = null,
): T[] {
  if (rows.length === 0) return rows

  const saved = orderByScope[resolveDirectoryFlatListScope(groupLabel)]
  if (!saved?.length) return rows

  const rowById = new Map(rows.map((row) => [row.item.id, row]))
  const ordered: T[] = []
  for (const id of saved) {
    const row = rowById.get(id)
    if (row) {
      ordered.push(row)
      rowById.delete(id)
    }
  }
  for (const row of rows) {
    if (rowById.has(row.item.id)) ordered.push(row)
  }

  return ordered.length === rows.length ? ordered : rows
}

export function resolveWorkItemParentIdForOrder(
  item: DirectoryOrderWorkItem,
  itemIds: Set<string>,
): string | null {
  if (item.parentId && itemIds.has(item.parentId)) return item.parentId
  if (item.featureId && itemIds.has(item.featureId)) return item.featureId
  if (item.epicId && itemIds.has(item.epicId)) return item.epicId
  return null
}

/** Reorder flat item list using saved sibling order (pre-order tree walk). */
export function applyDirectorySiblingOrder<T extends DirectoryOrderWorkItem>(
  items: T[],
  orderByScope: DirectorySiblingOrderMap,
  groupLabel: string | null = null,
): T[] {
  if (items.length === 0 || Object.keys(orderByScope).length === 0) return items

  const itemIds = new Set(items.map((entry) => entry.id))
  const childrenByParent = new Map<string | null, T[]>()

  for (const item of items) {
    const parentId = resolveWorkItemParentIdForOrder(item, itemIds)
    const bucket = childrenByParent.get(parentId) ?? []
    bucket.push(item)
    childrenByParent.set(parentId, bucket)
  }

  const scopeKey = (parentId: string | null) => directorySiblingScopeKey(parentId, groupLabel)

  const sortSiblings = (siblings: T[], parentId: string | null): T[] => {
    const saved = orderByScope[scopeKey(parentId)]
    if (!saved?.length) return siblings
    const rank = new Map(saved.map((id, index) => [id, index]))
    return [...siblings].sort((left, right) => {
      const leftRank = rank.get(left.id)
      const rightRank = rank.get(right.id)
      if (leftRank != null && rightRank != null) return leftRank - rightRank
      if (leftRank != null) return -1
      if (rightRank != null) return 1
      return left.id.localeCompare(right.id)
    })
  }

  const ordered: T[] = []
  const visited = new Set<string>()
  // `visited` guards against a corrupted/cyclic parent chain recursing forever.
  const walk = (parentId: string | null) => {
    for (const item of sortSiblings(childrenByParent.get(parentId) ?? [], parentId)) {
      if (visited.has(item.id)) continue
      visited.add(item.id)
      ordered.push(item)
      walk(item.id)
    }
  }
  walk(null)

  return ordered.length === items.length ? ordered : items
}

export function resolveDirectoryRowSiblingScope(
  item: DirectoryOrderWorkItem,
  itemIds: Set<string>,
  groupLabel: string | null,
): string {
  const parentId = resolveWorkItemParentIdForOrder(item, itemIds)
  return directorySiblingScopeKey(parentId, groupLabel)
}
