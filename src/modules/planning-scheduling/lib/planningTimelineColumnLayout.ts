import type { IApi } from '@svar-ui/react-gantt'

type GanttScaleData = NonNullable<ReturnType<IApi['getState']>['_scales']>

export type TimelineColumnLayout = {
  index: number
  start: Date
  end: Date
  width: number
}

type ScaleCellWithDate = {
  width: number
  date?: Date | string
}

function toDate(value: Date | string | undefined, fallback: Date): Date {
  if (!value) return fallback
  return value instanceof Date ? value : new Date(value)
}

export function buildTimelineColumnLayouts(
  scales: GanttScaleData,
  overrides: Record<number, number>,
  fallbackWidth: number,
): TimelineColumnLayout[] {
  const row = scales.rows[scales.rows.length - 1]
  if (!row?.cells?.length) return []

  const scaleEnd = toDate(scales.end, new Date())
  return row.cells.map((cell, index) => {
    const typed = cell as ScaleCellWithDate
    const start = toDate(typed.date, scaleEnd)
    const end =
      index + 1 < row.cells.length
        ? toDate((row.cells[index + 1] as ScaleCellWithDate).date, scaleEnd)
        : scaleEnd
    return {
      index,
      start,
      end,
      width: overrides[index] ?? typed.width ?? fallbackWidth,
    }
  })
}

export function dateToTimelineX(date: Date, columns: TimelineColumnLayout[]): number {
  const time = date.getTime()
  let x = 0

  for (const column of columns) {
    const start = column.start.getTime()
    const end = column.end.getTime()

    if (time >= end) {
      x += column.width
      continue
    }

    if (time <= start) break

    const span = end - start
    const fraction = span > 0 ? (time - start) / span : 0
    return x + fraction * column.width
  }

  return x
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`
}

function applyCellWidth(el: HTMLElement, width: number) {
  const px = `${Math.round(width)}px`
  el.style.width = px
  el.style.minWidth = px
  el.style.maxWidth = px
  el.style.flex = `0 0 ${px}`
}

function syncScaleRowCells(row: Element | null, widths: number[]) {
  if (!row) return
  const cells = row.querySelectorAll<HTMLElement>('.wx-cell')
  cells.forEach((cell, index) => {
    const width = widths[index]
    if (width == null) return
    applyCellWidth(cell, width)
  })
}

function syncTopScaleRowFromColumns(topRow: Element | null, columns: TimelineColumnLayout[]) {
  if (!topRow || columns.length === 0) return

  const groups: TimelineColumnLayout[][] = []
  let currentKey = ''
  for (const column of columns) {
    const key = monthKey(column.start)
    if (key !== currentKey || groups.length === 0) {
      groups.push([column])
      currentKey = key
    } else {
      groups[groups.length - 1].push(column)
    }
  }

  const topCells = topRow.querySelectorAll<HTMLElement>('.wx-cell')
  groups.forEach((group, index) => {
    const cell = topCells[index]
    if (!cell) return
    applyCellWidth(
      cell,
      group.reduce((sum, column) => sum + column.width, 0),
    )
  })
}

function syncBarPositions(host: HTMLElement, api: IApi, columns: TimelineColumnLayout[]) {
  if (columns.length === 0) return

  const bars = host.querySelectorAll<HTMLElement>('.wx-bar[data-task-id]')
  bars.forEach((bar) => {
    const id = bar.getAttribute('data-task-id')
    if (!id) return

    let task: { start?: Date; end?: Date; type?: string }
    try {
      task = api.getTask(id)
    } catch {
      return
    }

    if (!task?.start) return

    const start = task.start instanceof Date ? task.start : new Date(task.start)
    const endRaw = task.end ?? task.start
    const end = endRaw instanceof Date ? endRaw : new Date(endRaw)

    const x = dateToTimelineX(start, columns)
    const endX = dateToTimelineX(end, columns)
    const minWidth = task.type === 'milestone' ? 8 : 1
    const width = Math.max(minWidth, endX - x)

    bar.style.left = `${Math.round(x)}px`
    bar.style.width = `${Math.round(width)}px`
  })
}

export function syncVariableTimelineLayout(
  host: HTMLElement | null,
  api: IApi | null,
  overrides: Record<number, number>,
  fallbackWidth: number,
) {
  if (!host || !api || Object.keys(overrides).length === 0) return

  const scales = api.getState()._scales
  if (!scales?.rows?.length) return

  const columns = buildTimelineColumnLayouts(scales, overrides, fallbackWidth)
  if (columns.length === 0) return

  const scaleRoot = host.querySelector('.wx-scale')
  const scaleRows = host.querySelectorAll('.wx-scale .wx-row')
  const bottomRow = scaleRows[scaleRows.length - 1] ?? null
  const topRow = scaleRows[0] ?? null

  syncScaleRowCells(
    bottomRow,
    columns.map((column) => column.width),
  )
  if (scaleRows.length > 2) {
    for (let rowIndex = 1; rowIndex < scaleRows.length - 1; rowIndex += 1) {
      syncScaleRowCells(
        scaleRows[rowIndex],
        columns.map((column) => column.width),
      )
    }
  }
  if (scaleRows.length > 1) {
    syncTopScaleRowFromColumns(topRow, columns)
  }

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0)
  if (scaleRoot instanceof HTMLElement) {
    scaleRoot.style.width = `${Math.round(totalWidth)}px`
  }

  const chartArea = host.querySelector<HTMLElement>('.wx-chart .wx-area')
  if (chartArea) {
    chartArea.style.width = `${Math.round(totalWidth)}px`
  }

  syncBarPositions(host, api, columns)
}
