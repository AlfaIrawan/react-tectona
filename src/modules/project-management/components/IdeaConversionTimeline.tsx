import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { IdeaConversionSprint } from '@/lib/api/tectonaAgentRuntimeApi'

export type ConversionZoom = 'Day' | 'Week' | 'Month' | 'Quarter'

type FlatRow = {
  id: string
  title: string
  kind: 'sprint' | 'epic' | 'task' | 'subtask'
  depth: number
  startDate: string
  endDate: string
  durationDays: number
  parentId: string | null
}

function parseIso(value: string): Date {
  const [y, m, d] = (value || '').split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(Date.UTC(y, m - 1, d))
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000)
}

function formatDay(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, '0')
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = value.getUTCFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function flattenSprints(sprints: IdeaConversionSprint[]): FlatRow[] {
  const rows: FlatRow[] = []
  for (const sprint of sprints) {
    rows.push({
      id: sprint.id,
      title: sprint.title,
      kind: 'sprint',
      depth: 0,
      startDate: sprint.start_date,
      endDate: sprint.end_date,
      durationDays: sprint.duration_days,
      parentId: null,
    })
    for (const epic of sprint.epics) {
      rows.push({
        id: epic.id,
        title: epic.title,
        kind: 'epic',
        depth: 1,
        startDate: epic.start_date,
        endDate: epic.end_date,
        durationDays: epic.duration_days,
        parentId: sprint.id,
      })
      for (const task of epic.tasks) {
        rows.push({
          id: task.id,
          title: task.title,
          kind: 'task',
          depth: 2,
          startDate: task.start_date,
          endDate: task.end_date,
          durationDays: task.duration_days,
          parentId: epic.id,
        })
        for (const sub of task.sub_tasks) {
          rows.push({
            id: sub.id,
            title: sub.title,
            kind: 'subtask',
            depth: 3,
            startDate: sub.start_date,
            endDate: sub.end_date,
            durationDays: sub.duration_days,
            parentId: task.id,
          })
        }
      }
    }
  }
  return rows
}

function monthLabels(start: Date, end: Date): Array<{ label: string; offset: number; width: number }> {
  const labels: Array<{ label: string; offset: number; width: number }> = []
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const endMs = end.getTime()
  while (cursor.getTime() <= endMs) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
    const left = Math.max(0, daysBetween(start, cursor))
    const right = Math.max(left + 1, daysBetween(start, next < end ? next : addDays(end, 1)))
    labels.push({
      label: cursor.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      offset: left,
      width: Math.max(1, right - left),
    })
    cursor = next
  }
  return labels
}

const KIND_BAR: Record<FlatRow['kind'], string> = {
  sprint: 'bg-emerald-300/90',
  epic: 'bg-teal-400/90',
  task: 'bg-sky-500',
  subtask: 'bg-indigo-400',
}

type IdeaConversionTimelineProps = {
  sprints: IdeaConversionSprint[]
  className?: string
}

export function IdeaConversionTimeline({ sprints, className }: IdeaConversionTimelineProps) {
  const [zoom, setZoom] = useState<ConversionZoom>('Month')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const rows = useMemo(() => flattenSprints(sprints), [sprints])
  const visibleRows = useMemo(() => {
    const hiddenParents = new Set<string>()
    const out: FlatRow[] = []
    for (const row of rows) {
      if (row.parentId && (collapsed[row.parentId] || hiddenParents.has(row.parentId))) {
        hiddenParents.add(row.id)
        continue
      }
      out.push(row)
    }
    return out
  }, [rows, collapsed])

  const window = useMemo(() => {
    if (rows.length === 0) {
      const now = new Date()
      return {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0)),
      }
    }
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const row of rows) {
      min = Math.min(min, parseIso(row.startDate).getTime())
      max = Math.max(max, parseIso(row.endDate).getTime())
    }
    return { start: new Date(min - 3 * 86_400_000), end: new Date(max + 7 * 86_400_000) }
  }, [rows])

  const totalDays = Math.max(14, daysBetween(window.start, window.end) + 1)
  const pxPerDay = zoom === 'Day' ? 28 : zoom === 'Week' ? 12 : zoom === 'Quarter' ? 4 : 8
  const timelineWidth = totalDays * pxPerDay
  const labels = monthLabels(window.start, window.end)

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/50 bg-white', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Timeline & Gantt</p>
          <p className="text-[11px] text-slate-500">Sprint → Epic → Task → Sub-task</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border/50 bg-slate-50 p-0.5">
          {(['Day', 'Week', 'Month', 'Quarter'] as ConversionZoom[]).map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={zoom === level ? 'default' : 'ghost'}
              className="h-7 px-2 text-[11px]"
              onClick={() => setZoom(level)}
            >
              {level}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex max-h-[560px] overflow-auto">
        <div className="sticky left-0 z-10 w-[360px] shrink-0 border-r border-border/40 bg-white">
          <div className="grid grid-cols-[1fr_88px_56px] gap-2 border-b border-border/40 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Workspace</span>
            <span>Start</span>
            <span>Durasi</span>
          </div>
          {visibleRows.map((row) => {
            const hasChildren = rows.some((candidate) => candidate.parentId === row.id)
            const isCollapsed = Boolean(collapsed[row.id])
            return (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_88px_56px] gap-2 border-b border-border/30 px-3 py-2 text-xs text-slate-700"
              >
                <button
                  type="button"
                  className="flex items-start gap-1 text-left"
                  style={{ paddingLeft: row.depth * 14 }}
                  onClick={() => {
                    if (!hasChildren) return
                    setCollapsed((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                  }}
                >
                  <span className="mt-0.5 w-3 text-slate-400">{hasChildren ? (isCollapsed ? '▸' : '▾') : '•'}</span>
                  <span className={cn(row.kind === 'sprint' || row.kind === 'epic' ? 'font-semibold' : '')}>
                    {row.title}
                  </span>
                </button>
                <span className="tabular-nums text-slate-500">{formatDay(parseIso(row.startDate))}</span>
                <span className="tabular-nums text-slate-500">{row.durationDays}</span>
              </div>
            )
          })}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative border-b border-border/40 bg-slate-50" style={{ width: timelineWidth, height: 36 }}>
            {labels.map((label) => (
              <div
                key={`${label.label}-${label.offset}`}
                className="absolute top-0 h-full border-l border-slate-200 px-1 text-[10px] font-semibold text-slate-500"
                style={{ left: label.offset * pxPerDay, width: label.width * pxPerDay }}
              >
                <span className="inline-block pt-2">{label.label}</span>
              </div>
            ))}
          </div>
          {visibleRows.map((row) => {
            const start = parseIso(row.startDate)
            const end = parseIso(row.endDate)
            const left = Math.max(0, daysBetween(window.start, start)) * pxPerDay
            const width = Math.max(pxPerDay * 0.6, (Math.max(1, daysBetween(start, end) + 1)) * pxPerDay - 4)
            const isMilestone = row.durationDays <= 0
            return (
              <div key={`bar-${row.id}`} className="relative border-b border-border/20" style={{ width: timelineWidth, height: 41 }}>
                {isMilestone ? (
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-violet-400"
                    style={{ left: left + 2 }}
                    title={row.title}
                  />
                ) : (
                  <div
                    className={cn('absolute top-2 h-5 rounded-full shadow-sm', KIND_BAR[row.kind])}
                    style={{ left, width }}
                    title={`${row.title} (${row.durationDays}d)`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
