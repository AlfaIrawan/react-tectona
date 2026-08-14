import type { WorkItemApiModel, WorkStatus } from '@/lib/api/workApi'

export type ProjectCalendarEvent = {
  id: string
  title: string
  type: WorkItemApiModel['type']
  status: WorkStatus
  priority: WorkItemApiModel['priority']
  assignee: string
  startDate: string
  dueDate: string
}

export function parseCalendarIsoDate(iso: string): Date {
  const trimmed = iso.trim().slice(0, 10)
  const [year, month, day] = trimmed.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatCalendarDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function resolveWorkItemSchedule(item: WorkItemApiModel): { startDate: string; dueDate: string } | null {
  const due = item.dueDate?.trim().slice(0, 10)
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return null

  const startRaw = item.startDate?.trim().slice(0, 10)
  const start =
    startRaw && /^\d{4}-\d{2}-\d{2}$/.test(startRaw)
      ? startRaw
      : due

  const startDate = start <= due ? start : due
  const dueDate = start <= due ? due : start
  return { startDate, dueDate }
}

export function buildProjectCalendarEvents(items: WorkItemApiModel[]): ProjectCalendarEvent[] {
  return items.flatMap((item) => {
    const schedule = resolveWorkItemSchedule(item)
    if (!schedule) return []

    const status =
      (item.status as string) === 'Blocked' ? ('Backlog' as WorkStatus) : item.status

    return [
      {
        id: item.id,
        title: item.title,
        type: item.type,
        status,
        priority: item.priority,
        assignee: item.assignee,
        startDate: schedule.startDate,
        dueDate: schedule.dueDate,
      },
    ]
  })
}

export function groupCalendarEventsByDay(
  events: ProjectCalendarEvent[],
): Map<string, ProjectCalendarEvent[]> {
  const grouped = new Map<string, ProjectCalendarEvent[]>()

  for (const event of events) {
    const start = parseCalendarIsoDate(event.startDate)
    const end = parseCalendarIsoDate(event.dueDate)
    let cursor = start

    while (cursor.getTime() <= end.getTime()) {
      const key = formatCalendarDayKey(cursor)
      const bucket = grouped.get(key) ?? []
      if (!bucket.some((entry) => entry.id === event.id)) bucket.push(event)
      grouped.set(key, bucket)
      cursor = addCalendarDays(cursor, 1)
    }
  }

  for (const [key, bucket] of grouped.entries()) {
    grouped.set(
      key,
      [...bucket].sort((a, b) => a.title.localeCompare(b.title)),
    )
  }

  return grouped
}

export function buildMonthGridCells(viewYear: number, viewMonth: number): Array<{
  date: Date
  dayKey: string
  inCurrentMonth: boolean
}> {
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = addCalendarDays(firstOfMonth, -startOffset)
  const cells: Array<{ date: Date; dayKey: string; inCurrentMonth: boolean }> = []

  for (let index = 0; index < 42; index += 1) {
    const date = addCalendarDays(gridStart, index)
    cells.push({
      date,
      dayKey: formatCalendarDayKey(date),
      inCurrentMonth: date.getMonth() === viewMonth,
    })
  }

  return cells
}

export function formatCalendarMonthLabel(viewYear: number, viewMonth: number): string {
  return new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}
