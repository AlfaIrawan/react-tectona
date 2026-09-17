import { useMemo } from 'react'
import { Panel, useStore, useViewport } from 'reactflow'

const RULER_SIZE = 22
const MAJOR_STEP = 100
const MID_STEP = 50
const MINOR_STEP = 10

function rangeTicks(start: number, end: number, step: number): number[] {
  const first = Math.ceil(start / step) * step
  const ticks: number[] = []
  for (let value = first; value <= end + 0.01; value += step) {
    ticks.push(Math.round(value))
  }
  return ticks
}

export function CanvasViewportGrid() {
  const { x, y, zoom } = useViewport()
  const width = useStore((state) => state.width) || 0
  const height = useStore((state) => state.height) || 0

  const grid = useMemo(() => {
    if (width <= 0 || height <= 0 || zoom <= 0) {
      return { minors: [] as number[], mids: [] as number[], majors: [] as number[], vMinors: [] as number[], vMids: [] as number[], vMajors: [] as number[] }
    }
    const xStart = (0 - x) / zoom
    const xEnd = (width - x) / zoom
    const yStart = (0 - y) / zoom
    const yEnd = (height - y) / zoom
    const toX = (value: number) => value * zoom + x
    const toY = (value: number) => value * zoom + y
    const minorVisible = MINOR_STEP * zoom >= 6
    return {
      minors: minorVisible ? rangeTicks(xStart, xEnd, MINOR_STEP).map(toX) : [],
      mids: rangeTicks(xStart, xEnd, MID_STEP).map(toX),
      majors: rangeTicks(xStart, xEnd, MAJOR_STEP).map(toX),
      vMinors: minorVisible ? rangeTicks(yStart, yEnd, MINOR_STEP).map(toY) : [],
      vMids: rangeTicks(yStart, yEnd, MID_STEP).map(toY),
      vMajors: rangeTicks(yStart, yEnd, MAJOR_STEP).map(toY),
    }
  }, [height, width, x, y, zoom])

  if (width <= 0 || height <= 0) return null

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      width={width}
      height={height}
      style={{ zIndex: 0 }}
    >
      {grid.minors.map((px, index) => (
        <line key={`gx-min-${index}`} x1={px} y1={0} x2={px} y2={height} stroke="#edf1f5" strokeWidth="1" />
      ))}
      {grid.vMinors.map((px, index) => (
        <line key={`gy-min-${index}`} x1={0} y1={px} x2={width} y2={px} stroke="#edf1f5" strokeWidth="1" />
      ))}
      {grid.mids.map((px, index) => (
        <line key={`gx-mid-${index}`} x1={px} y1={0} x2={px} y2={height} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {grid.vMids.map((px, index) => (
        <line key={`gy-mid-${index}`} x1={0} y1={px} x2={width} y2={px} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {grid.majors.map((px, index) => (
        <line key={`gx-maj-${index}`} x1={px} y1={0} x2={px} y2={height} stroke="#d8e0e8" strokeWidth="1.25" />
      ))}
      {grid.vMajors.map((px, index) => (
        <line key={`gy-maj-${index}`} x1={0} y1={px} x2={width} y2={px} stroke="#d8e0e8" strokeWidth="1.25" />
      ))}
    </svg>
  )
}

export function CanvasViewportRulers() {
  const { x, y, zoom } = useViewport()
  const width = useStore((state) => state.width) || 0
  const height = useStore((state) => state.height) || 0

  const horizontal = useMemo(() => {
    if (width <= 0 || zoom <= 0) return { minors: [] as number[], mids: [] as number[], majors: [] as Array<{ value: number; px: number }> }
    const start = (0 - x) / zoom
    const end = (width - x) / zoom
    const toPx = (value: number) => value * zoom + x
    return {
      minors: rangeTicks(start, end, MINOR_STEP).map(toPx),
      mids: rangeTicks(start, end, MID_STEP).map(toPx),
      majors: rangeTicks(start, end, MAJOR_STEP).map((value) => ({ value, px: toPx(value) })),
    }
  }, [width, x, zoom])

  const vertical = useMemo(() => {
    if (height <= 0 || zoom <= 0) return { minors: [] as number[], mids: [] as number[], majors: [] as Array<{ value: number; px: number }> }
    const start = (0 - y) / zoom
    const end = (height - y) / zoom
    const toPx = (value: number) => value * zoom + y
    return {
      minors: rangeTicks(start, end, MINOR_STEP).map(toPx),
      mids: rangeTicks(start, end, MID_STEP).map(toPx),
      majors: rangeTicks(start, end, MAJOR_STEP).map((value) => ({ value, px: toPx(value) })),
    }
  }, [height, y, zoom])

  if (width <= 0 || height <= 0) return null

  const labelMajor = MAJOR_STEP * zoom >= 36
  const passThrough = { pointerEvents: 'none' as const }

  return (
    <>
      <Panel
        position="top-left"
        className="canvas-ruler-panel !m-0 !left-0 !top-0 !max-w-none !pointer-events-none"
        style={{ ...passThrough, width, height: RULER_SIZE, transform: 'none' }}
      >
        <svg aria-hidden width={width} height={RULER_SIZE} className="block border-b border-slate-200 bg-slate-50/95" style={passThrough}>
          {horizontal.minors.map((px, index) => (
            <line key={`h-min-${index}`} x1={px} y1={0} x2={px} y2={5} stroke="#94a3b8" strokeWidth="1" />
          ))}
          {horizontal.mids.map((px, index) => (
            <line key={`h-mid-${index}`} x1={px} y1={0} x2={px} y2={9} stroke="#64748b" strokeWidth="1" />
          ))}
          {horizontal.majors.map(({ value, px }) => (
            <g key={`h-maj-${value}`}>
              <line x1={px} y1={0} x2={px} y2={12} stroke="#475569" strokeWidth="1.25" />
              {labelMajor ? (
                <text x={px + 3} y={19} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize="9">
                  {value}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </Panel>

      <Panel
        position="top-left"
        className="canvas-ruler-panel !m-0 !left-0 !top-0 !max-w-none !pointer-events-none"
        style={{ ...passThrough, width: RULER_SIZE, height, transform: 'none' }}
      >
        <svg aria-hidden width={RULER_SIZE} height={height} className="block border-r border-slate-200 bg-slate-50/95" style={passThrough}>
          {vertical.minors.map((px, index) => (
            <line key={`v-min-${index}`} x1={0} y1={px} x2={5} y2={px} stroke="#94a3b8" strokeWidth="1" />
          ))}
          {vertical.mids.map((px, index) => (
            <line key={`v-mid-${index}`} x1={0} y1={px} x2={9} y2={px} stroke="#64748b" strokeWidth="1" />
          ))}
          {vertical.majors.map(({ value, px }) => (
            <g key={`v-maj-${value}`}>
              <line x1={0} y1={px} x2={12} y2={px} stroke="#475569" strokeWidth="1.25" />
              {labelMajor ? (
                <text x={11} y={px - 3} fill="#64748b" fontFamily="ui-monospace, monospace" fontSize="8" textAnchor="end">
                  {value}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </Panel>

      <Panel
        position="top-left"
        className="canvas-ruler-panel !m-0 !left-0 !top-0 !pointer-events-none"
        style={{ ...passThrough, width: RULER_SIZE, height: RULER_SIZE, transform: 'none' }}
      >
        <div className="h-full w-full border-b border-r border-slate-200 bg-slate-50" />
      </Panel>
    </>
  )
}
