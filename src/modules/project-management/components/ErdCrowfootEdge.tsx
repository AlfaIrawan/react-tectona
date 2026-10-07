import { BaseEdge, getSmoothStepPath, type EdgeProps } from 'reactflow'

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

function pathPoints(path: string): Array<{ x: number; y: number }> {
  const values = [...path.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((match) => Number(match[0])).filter((value) => Number.isFinite(value))
  const points: Array<{ x: number; y: number }> = []
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] })
  }
  return points
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

export function ErdCrowfootEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  })
  const ends = (data ?? {}) as ErdEdgeData
  const color = selected ? '#1D4ED8' : '#4B5563'
  const points = pathPoints(path)
  const sourceAway = points.length > 1
    ? { x: points[1].x - points[0].x, y: points[1].y - points[0].y }
    : { x: targetX - sourceX, y: targetY - sourceY }
  const last = points.length - 1
  const targetAway = points.length > 1
    ? { x: points[last - 1].x - points[last].x, y: points[last - 1].y - points[last].y }
    : { x: sourceX - targetX, y: sourceY - targetY }
  return (
    <>
      <BaseEdge path={path} style={{ stroke: color, strokeWidth: 1.25 }} />
      <g>
        {crowfoot(sourceX, sourceY, sourceAway.x, sourceAway.y, Boolean(ends.sourceMany), Boolean(ends.sourceOptional), color)}
        {crowfoot(targetX, targetY, targetAway.x, targetAway.y, Boolean(ends.targetMany), Boolean(ends.targetOptional), color)}
      </g>
    </>
  )
}
