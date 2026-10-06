import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, useReactFlow, useStore, type EdgeProps } from 'reactflow'
import { X } from 'lucide-react'
import { useWorkflowCanvasActions, type WorkflowWaypoint } from '@/modules/workflow-automation-engine/components/workflowCanvasActions'
import { nearestPortHandle, workflowEdgeEndpoints } from '@/modules/workflow-automation-engine/components/workflowEdgeGeometry'

function isWaypoint(value: unknown): value is WorkflowWaypoint {
  return typeof value === 'object'
    && value !== null
    && Number.isFinite((value as WorkflowWaypoint).x)
    && Number.isFinite((value as WorkflowWaypoint).y)
}

function isVertical(position: Position | undefined): boolean {
  return position === Position.Top || position === Position.Bottom
}

function waypointPath(
  fromX: number,
  fromY: number,
  sourcePosition: Position | undefined,
  waypoints: WorkflowWaypoint[],
  toX: number,
  toY: number,
  targetPosition: Position | undefined,
): string {
  let path = `M ${fromX},${fromY}`
  let currentX = fromX
  let currentY = fromY
  for (const [index, waypoint] of waypoints.entries()) {
    const verticalFirst = index === 0 ? isVertical(sourcePosition) : Math.abs(waypoint.y - currentY) >= Math.abs(waypoint.x - currentX)
    path += verticalFirst
      ? ` L ${currentX},${waypoint.y} L ${waypoint.x},${waypoint.y}`
      : ` L ${waypoint.x},${currentY} L ${waypoint.x},${waypoint.y}`
    currentX = waypoint.x
    currentY = waypoint.y
  }
  // The final segment must be perpendicular to the target node side. This makes
  // the arrowhead point into the target port instead of following the prior bend.
  return isVertical(targetPosition)
    ? `${path} L ${toX},${currentY} L ${toX},${toY}`
    : `${path} L ${currentX},${toY} L ${toX},${toY}`
}

function branchLabel(kind: unknown, sourceHandle: string | null | undefined, explicitLabel: unknown): string {
  if (typeof explicitLabel === 'string' && explicitLabel.trim()) return explicitLabel.trim()
  if (kind === 'approval') return sourceHandle === 'false' ? 'Rejected' : sourceHandle === 'true' ? 'Approved' : ''
  if (kind === 'ifElse') return sourceHandle === 'false' ? 'No' : sourceHandle === 'true' ? 'Yes' : ''
  if (kind === 'parallel') {
    if (sourceHandle === 'branchA') return 'Branch A'
    if (sourceHandle === 'branchB') return 'Branch B'
    if (sourceHandle === 'branchC') return 'Branch C'
    if (sourceHandle === 'branchD') return 'Branch D'
    return ''
  }
  if (kind === 'loop') return sourceHandle === 'body' ? 'Body' : sourceHandle === 'done' ? 'Done' : ''
  return ''
}

/**
 * Orthogonal arrow whose exit and entry sides follow the two nodes, the same way the idea
 * diagram chooses a side. The stored sourceHandle (true / false / branch) is left alone so
 * the workflow engine still knows which branch this edge is.
 */
export function WorkflowRoutedEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  style,
  label,
  selected,
}: EdgeProps) {
  const actions = useWorkflowCanvasActions()
  const { screenToFlowPosition } = useReactFlow()
  const nodeInternals = useStore((state) => state.nodeInternals)
  const edges = useStore((state) => state.edges)
  const [isHovered, setIsHovered] = useState(false)

  let fromX = sourceX
  let fromY = sourceY
  let toX = targetX
  let toY = targetY
  let fromPosition = sourcePosition
  let toPosition = targetPosition

  const edge = edges.find((candidate) => candidate.id === id) ?? { id, source, target, sourceHandle: sourceHandleId }
  const endpoints = workflowEdgeEndpoints(edge, nodeInternals, edges)
  if (endpoints) {
    fromX = endpoints.source.x
    fromY = endpoints.source.y
    toX = endpoints.target.x
    toY = endpoints.target.y
    fromPosition = endpoints.source.position
    toPosition = endpoints.target.position
  }

  const [automaticPath, automaticLabelX, automaticLabelY] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    borderRadius: 8,
  })
  const storedHandle = sourceHandleId ?? edges.find((edge) => edge.id === id)?.sourceHandle
  const stroke = branchStroke(storedHandle, selected, String(style?.stroke ?? '#94a3b8'))
  const markerId = `wf-edge-arrow-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const sourceKind = (nodeInternals.get(source)?.data as { kind?: string } | undefined)?.kind
  const resolvedLabel = branchLabel(sourceKind, storedHandle, label)
  const storedWaypoints = Array.isArray((edge.data as { waypoints?: unknown } | undefined)?.waypoints)
    ? (edge.data as { waypoints: unknown[] }).waypoints.filter(isWaypoint).slice(-1)
    : []
  const path = storedWaypoints.length > 0
    ? waypointPath(fromX, fromY, fromPosition, storedWaypoints, toX, toY, toPosition)
    : automaticPath
  const firstWaypoint = storedWaypoints[0]
  const labelX = firstWaypoint
    ? (isVertical(fromPosition) ? (fromX + firstWaypoint.x) / 2 : firstWaypoint.x)
    : automaticLabelX
  const labelY = firstWaypoint
    ? (isVertical(fromPosition) ? firstWaypoint.y : (fromY + firstWaypoint.y) / 2)
    : automaticLabelY
  const visibleWaypoints = storedWaypoints.length > 0 ? storedWaypoints : [{ x: automaticLabelX, y: automaticLabelY }]
  const showWaypointControls = selected || isHovered

  const startWaypointDrag = (index: number, event: ReactPointerEvent<SVGCircleElement>) => {
    if (!actions) return
    event.preventDefault()
    event.stopPropagation()
    let next = storedWaypoints.length > 0 ? [...storedWaypoints] : [{ x: automaticLabelX, y: automaticLabelY }]
    actions.setEdgeWaypoints(id, next)
    const move = (pointerEvent: PointerEvent) => {
      const point = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY })
      next = next.map((waypoint, waypointIndex) => (waypointIndex === index ? point : waypoint))
      actions.setEdgeWaypoints(id, next)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const addWaypoint = (event: ReactPointerEvent<SVGPathElement>) => {
    if (!actions) return
    event.preventDefault()
    event.stopPropagation()
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    // A workflow edge keeps one editable routing bend. Replacing it on a later
    // double-click prevents a stack of elbows from obscuring the flow.
    actions.setEdgeWaypoints(id, [point])
  }

  const removeWaypoint = () => {
    actions?.setEdgeWaypoints(id, [])
  }

  const startAnchorDrag = (endpoint: 'source' | 'target', event: ReactPointerEvent<SVGCircleElement>) => {
    if (!actions) return
    event.preventDefault()
    event.stopPropagation()
    const anchoredNode = nodeInternals.get(endpoint === 'source' ? source : target)
    const move = (pointerEvent: PointerEvent) => {
      const point = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY })
      const portId = nearestPortHandle(anchoredNode, point)
      if (portId) actions.setEdgeAnchor(id, endpoint, portId)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <>
      <defs>
        <marker id={markerId} viewBox="0 0 12 12" markerWidth="10" markerHeight="10" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M2 2 L10 6 L2 10 Z" fill={stroke} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${markerId})`}
        style={{ ...style, stroke, strokeWidth: selected ? 2.5 : 2 }}
        interactionWidth={16}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="workflow-routed-edge-hit-area"
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        onDoubleClick={addWaypoint}
      />
      <circle
        className="workflow-routed-edge-endpoint workflow-routed-edge-anchor"
        cx={fromX}
        cy={fromY}
        r={4}
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={2}
        onPointerDown={(event) => startAnchorDrag('source', event)}
      />
      <circle
        className="workflow-routed-edge-endpoint workflow-routed-edge-anchor"
        cx={toX}
        cy={toY}
        r={3.5}
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={2}
        onPointerDown={(event) => startAnchorDrag('target', event)}
      />
      {showWaypointControls ? visibleWaypoints.map((waypoint, index) => (
        <g key={`${id}-waypoint-${index}`}>
          <circle
            cx={waypoint.x}
            cy={waypoint.y}
            r={5}
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={2}
            className="workflow-routed-edge-waypoint"
            onPointerDown={(event) => startWaypointDrag(index, event)}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              removeWaypoint()
            }}
          />
          {storedWaypoints.length > 0 ? (
            <foreignObject x={waypoint.x + 8} y={waypoint.y - 18} width={24} height={24} className="overflow-visible">
              <button
                type="button"
                title="Remove waypoint"
                aria-label="Remove waypoint"
                className="nodrag nopan flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  removeWaypoint()
                }}
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </foreignObject>
          ) : null}
        </g>
      )) : null}
      {resolvedLabel ? (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, color: stroke }}
            className="nodrag nopan pointer-events-none absolute rounded-full border border-current bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm"
          >
            {resolvedLabel}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

/** True follows the green handle, false the red one. Other edges stay neutral. */
function branchStroke(sourceHandle: string | null | undefined, selected: boolean, fallback: string): string {
  if (sourceHandle === 'true') return selected ? '#047857' : '#10b981'
  if (sourceHandle === 'false') return selected ? '#be123c' : '#ef4444'
  if (sourceHandle === 'branchA') return selected ? '#1d4ed8' : '#2563eb'
  if (sourceHandle === 'branchB') return selected ? '#4338ca' : '#4f46e5'
  if (sourceHandle === 'branchC') return selected ? '#6d28d9' : '#7c3aed'
  if (sourceHandle === 'branchD') return selected ? '#0e7490' : '#0891b2'
  return selected ? '#0f172a' : fallback
}
