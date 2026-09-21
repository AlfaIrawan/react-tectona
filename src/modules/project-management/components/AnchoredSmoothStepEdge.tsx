import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  useReactFlow,
  useStore,
  type EdgeProps,
} from 'reactflow'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { IntegrationEdgeArrow } from '@/modules/project-management/lib/integrationArchitectureTypes'
import {
  readEdgeData,
  edgeStrokeStyle,
  resolveEdgeArrange,
  resolveEdgeTextStyle,
  resolveEdgeVisual,
} from '@/modules/project-management/lib/integrationEdgeAppearance'

function pathPoints(path: string): Array<{ x: number; y: number }> {
  const values = [...path.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((match) => Number(match[0])).filter((value) => Number.isFinite(value))
  const points: Array<{ x: number; y: number }> = []
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] })
  }
  return points
}

function lastPathVector(path: string): { dx: number; dy: number; x: number; y: number } {
  const points = pathPoints(path)
  for (let index = points.length - 1; index > 0; index -= 1) {
    const dx = points[index].x - points[index - 1].x
    const dy = points[index].y - points[index - 1].y
    if (Math.hypot(dx, dy) > 0.5) return { dx, dy, x: points[index].x, y: points[index].y }
  }
  const end = points[points.length - 1] ?? { x: 0, y: 0 }
  return { dx: 1, dy: 0, x: end.x, y: end.y }
}

function firstPathVector(path: string): { dx: number; dy: number; x: number; y: number } {
  const points = pathPoints(path)
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x
    const dy = points[index].y - points[index - 1].y
    if (Math.hypot(dx, dy) > 0.5) return { dx, dy, x: points[0].x, y: points[0].y }
  }
  const start = points[0] ?? { x: 0, y: 0 }
  return { dx: 1, dy: 0, x: start.x, y: start.y }
}

function unit(dx: number, dy: number) {
  const length = Math.hypot(dx, dy) || 1
  return { ux: dx / length, uy: dy / length }
}

const ALIGN_TOLERANCE_PX = 24

function isHorizontalHandle(position: Position) {
  return position === Position.Left || position === Position.Right
}

function isVerticalHandle(position: Position) {
  return position === Position.Top || position === Position.Bottom
}

function arrowMarker(
  kind: IntegrationEdgeArrow,
  x: number,
  y: number,
  dx: number,
  dy: number,
  size: number,
  filled: boolean,
  color: string,
) {
  if (kind === 'none') return null
  const { ux, uy } = unit(dx, dy)
  const px = -uy
  const py = ux
  const s = Math.max(4, size)

  if (kind === 'oval') {
    return (
      <circle
        cx={x - ux * s * 0.35}
        cy={y - uy * s * 0.35}
        r={s * 0.35}
        fill={filled ? color : 'white'}
        stroke={color}
        strokeWidth={1.25}
        pointerEvents="none"
      />
    )
  }

  if (kind === 'dash') {
    return (
      <line
        x1={x - px * s * 0.55}
        y1={y - py * s * 0.55}
        x2={x + px * s * 0.55}
        y2={y + py * s * 0.55}
        stroke={color}
        strokeWidth={Math.max(1.5, s / 4)}
        pointerEvents="none"
      />
    )
  }

  if (kind === 'open') {
    const baseX = x - ux * s
    const baseY = y - uy * s
    return (
      <polyline
        points={`${baseX + px * s * 0.55},${baseY + py * s * 0.55} ${x},${y} ${baseX - px * s * 0.55},${baseY - py * s * 0.55}`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        pointerEvents="none"
      />
    )
  }

  if (kind === 'diamond') {
    const tipX = x
    const tipY = y
    const midX = x - ux * s
    const midY = y - uy * s
    const backX = x - ux * s * 1.7
    const backY = y - uy * s * 1.7
    const points = `${tipX},${tipY} ${midX + px * s * 0.55},${midY + py * s * 0.55} ${backX},${backY} ${midX - px * s * 0.55},${midY - py * s * 0.55}`
    return (
      <polygon
        points={points}
        fill={filled ? color : 'white'}
        stroke={color}
        strokeLinejoin="round"
        pointerEvents="none"
      />
    )
  }

  const baseX = x - ux * s
  const baseY = y - uy * s
  const points = `${x},${y} ${baseX + px * s * 0.55},${baseY + py * s * 0.55} ${baseX - px * s * 0.55},${baseY - py * s * 0.55}`
  return (
    <polygon
      points={points}
      fill={kind === 'classic' || filled ? color : 'white'}
      stroke={color}
      strokeLinejoin="round"
      pointerEvents="none"
    />
  )
}

export function AnchoredSmoothStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  label,
  selected,
  data,
}: EdgeProps) {
  const { setEdges, setNodes } = useReactFlow()
  const zoom = useStore((state) => state.transform[2]) || 1
  const labelBoxRef = useRef<HTMLDivElement | null>(null)
  const labelEditorRef = useRef<HTMLInputElement | null>(null)
  const labelInteractRef = useRef<{
    pointerId: number
    kind: 'move' | 'e' | 's' | 'se'
    startX: number
    startY: number
    originX: number
    originY: number
    originW: number
    originH: number
  } | null>(null)
  const [liveLabel, setLiveLabel] = useState<{ offsetX: number; offsetY: number; boxWidth: number; boxHeight: number } | null>(null)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const visual = resolveEdgeVisual({ id, style, data })
  const textStyle = resolveEdgeTextStyle({ data })
  const arrange = resolveEdgeArrange({ data })

  const terminal = arrange.terminalSpacing
  const startOffset = visual.startSpacing + terminal
  const endOffset = visual.endSpacing + terminal
  const startVec = unit(targetX - sourceX, targetY - sourceY)
  const adjustedSourceX = sourceX + startVec.ux * startOffset
  const adjustedSourceY = sourceY + startVec.uy * startOffset
  const adjustedTargetX = targetX - startVec.ux * endOffset
  const adjustedTargetY = targetY - startVec.uy * endOffset

  const pathArgs = {
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    sourcePosition,
    targetPosition,
  }

  const [path, midX, midY] = (() => {
    if (arrange.orthogonal === false && visual.waypoints === 'sharp') {
      return getStraightPath(pathArgs)
    }
    if (visual.waypoints === 'curved') {
      return getBezierPath(pathArgs)
    }
    const alignedHorizontally =
      isHorizontalHandle(sourcePosition) &&
      isHorizontalHandle(targetPosition) &&
      Math.abs(adjustedSourceY - adjustedTargetY) <= ALIGN_TOLERANCE_PX
    if (alignedHorizontally) {
      return getStraightPath(pathArgs)
    }
    const alignedVertically =
      isVerticalHandle(sourcePosition) &&
      isVerticalHandle(targetPosition) &&
      Math.abs(adjustedSourceX - adjustedTargetX) <= ALIGN_TOLERANCE_PX
    if (alignedVertically) {
      return getStraightPath(pathArgs)
    }
    return getSmoothStepPath({
      ...pathArgs,
      borderRadius: visual.waypoints === 'rounded' ? Math.max(0, arrange.arcSize) : 0,
      offset: 8,
    })
  })()

  const strokeStyle = edgeStrokeStyle(visual, arrange)
  const restStroke = String(strokeStyle.stroke ?? '#334155')
  const stroke = selected ? '#0284c7' : restStroke
  const strokeWidth = selected ? Math.max(Number(strokeStyle.strokeWidth ?? 2), 2.5) : Number(strokeStyle.strokeWidth ?? 2)
  const labelText = typeof label === 'string' ? label : ''
  const endDirection = lastPathVector(path)
  const startDirection = firstPathVector(path)
  const labelT = textStyle.position === 'source' ? 0.18 : textStyle.position === 'target' ? 0.82 : 0.5
  const placedLabelX = textStyle.position === 'center' ? midX : adjustedSourceX + (adjustedTargetX - adjustedSourceX) * labelT
  const placedLabelY = textStyle.position === 'center' ? midY : adjustedSourceY + (adjustedTargetY - adjustedSourceY) * labelT

  const selectEdge = (event: ReactMouseEvent) => {
    event.stopPropagation()
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: false })))
    setEdges((edges) => edges.map((edge) => ({ ...edge, selected: edge.id === id })))
  }

  const offsetX = liveLabel?.offsetX ?? textStyle.offsetX
  const offsetY = liveLabel?.offsetY ?? textStyle.offsetY
  const boxWidth = liveLabel?.boxWidth ?? textStyle.boxWidth
  const boxHeight = liveLabel?.boxHeight ?? textStyle.boxHeight
  const wrapLabel = textStyle.wordWrap || boxWidth > 0 || boxHeight > 0

  useEffect(() => {
    if (!isEditingLabel) return
    labelEditorRef.current?.focus()
    labelEditorRef.current?.select()
  }, [isEditingLabel])

  const finishLabelEditing = (commit: boolean) => {
    setIsEditingLabel(false)
    if (!commit) return
    const nextLabel = labelDraft.trim()
    if (!nextLabel || nextLabel === labelText) return
    setEdges((edges) => edges.map((edge) => (edge.id === id ? { ...edge, label: nextLabel, selected: true } : edge)))
  }

  const handleLabelEditorKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      finishLabelEditing(false)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      finishLabelEditing(true)
    }
  }

  const commitLabelBox = (next: { offsetX: number; offsetY: number; boxWidth: number; boxHeight: number }) => {
    setEdges((edges) => edges.map((edge) => {
      if (edge.id !== id) return edge
      const stored = readEdgeData(edge)
      return {
        ...edge,
        selected: true,
        data: {
          ...stored,
          textStyle: {
            ...stored.textStyle,
            offsetX: next.offsetX,
            offsetY: next.offsetY,
            boxWidth: next.boxWidth,
            boxHeight: next.boxHeight,
            wordWrap: next.boxWidth > 0 || next.boxHeight > 0 || Boolean(stored.textStyle?.wordWrap),
          },
        },
      }
    }))
    setLiveLabel(null)
  }

  const measuredBox = () => {
    const rect = labelBoxRef.current?.getBoundingClientRect()
    return {
      width: boxWidth > 0 ? boxWidth : Math.max(72, (rect?.width ?? 120) / zoom),
      height: boxHeight > 0 ? boxHeight : Math.max(24, (rect?.height ?? 28) / zoom),
    }
  }

  const beginLabelInteract = (kind: 'move' | 'e' | 's' | 'se') => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
    const measured = measuredBox()
    labelInteractRef.current = {
      pointerId: event.pointerId,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetX,
      originY: offsetY,
      originW: measured.width,
      originH: measured.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: false })))
    setEdges((edges) => edges.map((edge) => ({ ...edge, selected: edge.id === id })))
  }

  const moveLabelInteract = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = labelInteractRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = (event.clientX - drag.startX) / zoom
    const dy = (event.clientY - drag.startY) / zoom
    if (drag.kind === 'move') {
      setLiveLabel({
        offsetX: drag.originX + dx,
        offsetY: drag.originY + dy,
        boxWidth,
        boxHeight,
      })
      return
    }
    const nextWidth = drag.kind === 's' ? drag.originW : Math.max(72, drag.originW + dx)
    const nextHeight = drag.kind === 'e' ? boxHeight : Math.max(24, drag.originH + dy)
    setLiveLabel({
      offsetX: drag.originX,
      offsetY: drag.originY,
      boxWidth: nextWidth,
      boxHeight: nextHeight,
    })
  }

  const endLabelInteract = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = labelInteractRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    labelInteractRef.current = null
    const dx = (event.clientX - drag.startX) / zoom
    const dy = (event.clientY - drag.startY) / zoom
    if (drag.kind === 'move') {
      commitLabelBox({
        offsetX: drag.originX + dx,
        offsetY: drag.originY + dy,
        boxWidth,
        boxHeight,
      })
      return
    }
    commitLabelBox({
      offsetX: drag.originX,
      offsetY: drag.originY,
      boxWidth: drag.kind === 's' ? drag.originW : Math.max(72, drag.originW + dx),
      boxHeight: drag.kind === 'e' ? boxHeight : Math.max(24, drag.originH + dy),
    })
  }

  const pathStyle: CSSProperties = {
    ...style,
    ...strokeStyle,
    stroke,
    strokeWidth,
    pointerEvents: 'stroke',
    cursor: 'pointer',
    animation: arrange.flowAnimation ? 'diagram-edge-flow 0.9s linear infinite' : undefined,
    strokeDasharray: arrange.flowAnimation
      ? (strokeStyle.strokeDasharray || '8 8')
      : strokeStyle.strokeDasharray,
  }

  const labelOpacity = Math.max(0, Math.min(100, textStyle.opacity)) / 100
  const alignItems = textStyle.verticalAlign === 'top' ? 'flex-start' : textStyle.verticalAlign === 'bottom' ? 'flex-end' : 'center'

  return (
    <>
      {arrange.backgroundOutline ? (
        <path
          d={path}
          fill="none"
          stroke="white"
          strokeWidth={strokeWidth + 4}
          pointerEvents="none"
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke="rgba(2, 132, 199, 0.01)"
        strokeWidth={24}
        className="react-flow__edge-interaction"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={selectEdge}
      />
      <BaseEdge
        id={id}
        path={path}
        style={pathStyle}
        interactionWidth={24}
        markerEnd={undefined}
        markerStart={undefined}
      />
      {arrowMarker(visual.startArrow, startDirection.x, startDirection.y, -startDirection.dx, -startDirection.dy, visual.startSize, visual.startFill, stroke)}
      {arrowMarker(visual.endArrow, endDirection.x, endDirection.y, endDirection.dx, endDirection.dy, visual.endSize, visual.endFill, stroke)}
      {labelText && !arrange.ignoreEdge ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${placedLabelX + offsetX}px, ${placedLabelY + offsetY}px) rotate(${textStyle.angle}deg)`,
              pointerEvents: 'all',
              zIndex: 8,
            }}
          >
            <div
              ref={labelBoxRef}
              role="button"
              tabIndex={0}
              dir={textStyle.writingDirection === 'automatic' ? undefined : textStyle.writingDirection}
              style={{
                boxSizing: 'border-box',
                width: boxWidth > 0 ? boxWidth : 'max-content',
                minWidth: 72,
                height: boxHeight > 0 ? boxHeight : 'auto',
                minHeight: 24,
                padding: `${4 + textStyle.spacingTop}px ${8 + textStyle.spacingRight}px ${4 + textStyle.spacingBottom}px ${8 + textStyle.spacingLeft}px`,
                borderRadius: 6,
                border: textStyle.borderColorEnabled
                  ? `1px solid ${textStyle.borderColor}`
                  : selected
                    ? '1px solid #0284c7'
                    : '1px solid #cbd5e1',
                background: textStyle.backgroundColorEnabled
                  ? textStyle.backgroundColor
                  : selected
                    ? '#e0f2fe'
                    : 'rgba(255,255,255,0.95)',
                color: textStyle.fontColorEnabled ? textStyle.fontColor : '#0f172a',
                fontFamily: textStyle.fontFamily,
                fontSize: textStyle.fontSize,
                fontWeight: textStyle.bold ? 700 : 400,
                fontStyle: textStyle.italic ? 'italic' : 'normal',
                textDecoration: textStyle.underline ? 'underline' : 'none',
                lineHeight: `${Math.max(100, textStyle.lineHeight)}%`,
                letterSpacing: textStyle.spacingGlobal ? `${textStyle.spacingGlobal}px` : undefined,
                textAlign: textStyle.align,
                display: 'flex',
                alignItems,
                opacity: labelOpacity,
                whiteSpace: wrapLabel ? 'pre-wrap' : 'nowrap',
                overflowWrap: wrapLabel ? 'break-word' : 'normal',
                overflow: 'hidden',
                cursor: isEditingLabel ? 'text' : 'move',
                boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
              }}
              onClick={selectEdge}
              onDoubleClick={(event) => {
                event.stopPropagation()
                setLabelDraft(labelText)
                setIsEditingLabel(true)
              }}
              onPointerDown={isEditingLabel ? undefined : beginLabelInteract('move')}
              onPointerMove={isEditingLabel ? undefined : moveLabelInteract}
              onPointerUp={isEditingLabel ? undefined : endLabelInteract}
              onPointerCancel={isEditingLabel ? undefined : endLabelInteract}
            >
              {isEditingLabel ? (
                <input
                  ref={labelEditorRef}
                  value={labelDraft}
                  onChange={(event) => setLabelDraft(event.target.value)}
                  onBlur={() => finishLabelEditing(true)}
                  onKeyDown={handleLabelEditorKeyDown}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="nodrag nopan min-w-0 flex-1 bg-transparent p-0 text-inherit outline-none"
                  style={{ font: 'inherit', letterSpacing: 'inherit', textAlign: 'inherit' }}
                  aria-label="Edit arrow label"
                />
              ) : labelText}
            </div>
            {selected ? (
              <>
                <div
                  role="separator"
                  aria-label="Ubah lebar label"
                  className="absolute inset-y-1 right-0 w-1.5 cursor-ew-resize rounded-full hover:bg-sky-400/50"
                  onPointerDown={beginLabelInteract('e')}
                  onPointerMove={moveLabelInteract}
                  onPointerUp={endLabelInteract}
                  onPointerCancel={endLabelInteract}
                />
                <div
                  role="separator"
                  aria-label="Ubah tinggi label"
                  className="absolute inset-x-1 bottom-0 h-1.5 cursor-ns-resize rounded-full hover:bg-sky-400/50"
                  onPointerDown={beginLabelInteract('s')}
                  onPointerMove={moveLabelInteract}
                  onPointerUp={endLabelInteract}
                  onPointerCancel={endLabelInteract}
                />
                <div
                  role="separator"
                  aria-label="Ubah ukuran label"
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
                  onPointerDown={beginLabelInteract('se')}
                  onPointerMove={moveLabelInteract}
                  onPointerUp={endLabelInteract}
                  onPointerCancel={endLabelInteract}
                />
              </>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
