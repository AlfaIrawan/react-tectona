export type GridSelectionModifiers = {
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

export function gridSelectionModifiersFromMouseEvent(event: {
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}): GridSelectionModifiers {
  return {
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
  }
}

export function applyOrderedGridSelection(
  itemId: string,
  orderedIds: string[],
  previous: Set<string>,
  anchorId: string | null,
  modifiers: GridSelectionModifiers,
): { next: Set<string>; anchorId: string | null; isSelectionMode: boolean } {
  const ctrlOrMeta = modifiers.ctrlKey || modifiers.metaKey

  if (modifiers.shiftKey && anchorId) {
    const start = orderedIds.indexOf(anchorId)
    const end = orderedIds.indexOf(itemId)
    if (start >= 0 && end >= 0) {
      const [from, to] = start <= end ? [start, end] : [end, start]
      const next = new Set(orderedIds.slice(from, to + 1))
      return { next, anchorId, isSelectionMode: next.size > 0 }
    }
  }

  if (ctrlOrMeta) {
    const next = new Set(previous)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    return {
      next,
      anchorId: itemId,
      isSelectionMode: next.size > 0,
    }
  }

  if (previous.size === 1 && previous.has(itemId)) {
    return { next: new Set(), anchorId: null, isSelectionMode: false }
  }

  return {
    next: new Set([itemId]),
    anchorId: itemId,
    isSelectionMode: true,
  }
}
