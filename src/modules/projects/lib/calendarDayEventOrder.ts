import type { ProjectCalendarEvent } from './buildProjectCalendarEvents'

export type CalendarDayOrderMap = Record<string, string[]>

const calendarDayOrderByScope = new Map<string, CalendarDayOrderMap>()

export function loadCalendarDayOrderMap(scope: string): CalendarDayOrderMap {
  return { ...(calendarDayOrderByScope.get(scope) ?? {}) }
}

export function saveCalendarDayOrder(scope: string, dayKey: string, order: string[]): CalendarDayOrderMap {
  const nextMap = {
    ...(calendarDayOrderByScope.get(scope) ?? {}),
    [dayKey]: order,
  }
  calendarDayOrderByScope.set(scope, nextMap)
  return nextMap
}

export function applyCalendarDayOrder(
  events: ProjectCalendarEvent[],
  preferredOrder: string[] | undefined,
): ProjectCalendarEvent[] {
  if (!preferredOrder?.length) {
    return [...events].sort((a, b) => a.title.localeCompare(b.title))
  }

  const byId = new Map(events.map((event) => [event.id, event]))
  const ordered: ProjectCalendarEvent[] = []

  for (const id of preferredOrder) {
    const event = byId.get(id)
    if (!event) continue
    ordered.push(event)
    byId.delete(id)
  }

  const remainder = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title))
  return [...ordered, ...remainder]
}

export function buildCalendarDayOrderFromEvents(events: ProjectCalendarEvent[]): string[] {
  return applyCalendarDayOrder(events, undefined).map((event) => event.id)
}

export function reorderCalendarDayItems(
  order: string[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after',
): string[] {
  if (draggedId === targetId) return order

  const fromIndex = order.indexOf(draggedId)
  const targetIndex = order.indexOf(targetId)
  if (fromIndex < 0 || targetIndex < 0) return order

  const normalizedPosition = normalizeCalendarReorderPosition(order, draggedId, targetId, position)
  let toIndex = normalizedPosition === 'before' ? targetIndex : targetIndex + 1

  const next = [...order]
  next.splice(fromIndex, 1)
  if (fromIndex < toIndex) toIndex -= 1
  next.splice(toIndex, 0, draggedId)
  return next
}

/** Avoid no-op drops when pointer lands on the "wrong" half of a target chip. */
export function normalizeCalendarReorderPosition(
  order: string[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after',
): 'before' | 'after' {
  const fromIndex = order.indexOf(draggedId)
  const targetIndex = order.indexOf(targetId)
  if (fromIndex < 0 || targetIndex < 0) return position

  if (fromIndex > targetIndex && position === 'after') {
    return 'before'
  }
  if (fromIndex < targetIndex && position === 'before') {
    return 'after'
  }
  return position
}

export function moveCalendarDayItemToStart(order: string[], draggedId: string): string[] {
  return [draggedId, ...order.filter((id) => id !== draggedId)]
}

export function moveCalendarDayItemToEnd(order: string[], draggedId: string): string[] {
  const withoutDragged = order.filter((id) => id !== draggedId)
  return [...withoutDragged, draggedId]
}
