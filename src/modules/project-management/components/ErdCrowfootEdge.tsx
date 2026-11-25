import type { EdgeProps } from 'reactflow'
import { AnchoredSmoothStepEdge } from './AnchoredSmoothStepEdge'
import { readEdgeData } from '@/modules/project-management/lib/integrationEdgeAppearance'

type ErdEdgeData = {
  sourceMany?: boolean
  targetMany?: boolean
  sourceOptional?: boolean
  targetOptional?: boolean
}

function unit(dx: number, dy: number) {
  const length = Math.hypot(dx, dy) || 1
  return { ux: dx / length, uy: dy / length }
}

function crowfoot(
  x: number,
  y: number,
  awayX: number,
  awayY: number,
  many: boolean,
  optional: boolean,
  color: string,
) {
  const { ux, uy } = unit(awayX, awayY)
  const px = -uy
  const py = ux
  const heelX = x + ux * 14
  const heelY = y + uy * 14
  const spread = 7
  const marks = []
  if (many) {
    marks.push(
      <path
        key="foot"
        d={`M ${heelX} ${heelY} L ${x + px * spread} ${y + py * spread} M ${heelX} ${heelY} L ${x} ${y} M ${heelX} ${heelY} L ${x - px * spread} ${y - py * spread}`}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
      />,
    )
  }
  const markX = x + ux * (many ? 16 : 3)
  const markY = y + uy * (many ? 16 : 3)
  if (optional) {
    marks.push(<circle key="optional" cx={markX + ux * 5} cy={markY + uy * 5} r={3.5} fill="#ffffff" stroke={color} strokeWidth={1.25} />)
  } else {
    marks.push(
      <path
        key="bar"
        d={`M ${markX + px * 6} ${markY + py * 6} L ${markX - px * 6} ${markY - py * 6}`}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
      />,
    )
  }
  return marks
}

/** Share routing, labels and interaction permissions while retaining ERD cardinality glyphs. */
export function ErdCrowfootEdge(props: EdgeProps) {
  const ends = (props.data ?? {}) as ErdEdgeData
  const stored = readEdgeData(props)
  const data = { ...props.data, arrange: { arcSize: 12, ...stored.arrange } }
  return <AnchoredSmoothStepEdge {...props} data={data} style={{ stroke: '#4B5563', strokeWidth: 1.25, ...props.style }}
    renderMarkers={(start, end, color) => <>
      {crowfoot(start.x, start.y, start.dx, start.dy, Boolean(ends.sourceMany), Boolean(ends.sourceOptional), color)}
      {crowfoot(end.x, end.y, -end.dx, -end.dy, Boolean(ends.targetMany), Boolean(ends.targetOptional), color)}
    </>} />
}
