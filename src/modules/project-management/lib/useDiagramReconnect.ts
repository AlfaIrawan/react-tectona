import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { Position, type Connection, type Edge, type Node } from 'reactflow'
import { magneticDiagramAnchor, magneticAnchorHandle } from './diagramEndpointAnchors'
import { connectionPreviewTargetPosition } from './diagramConnections'
export type DiagramEndpoint = { x: number; y: number; position: Position }
export type DiagramReconnectPreview = { edgeId: string; source: DiagramEndpoint; target: DiagramEndpoint }
type Start = DiagramReconnectPreview & { movingEnd: 'source' | 'target' }
type Drag = Start & { edge: Edge; pointerId: number; startClient: { x: number; y: number }; client: { x: number; y: number }; grabOffset: { x: number; y: number } }
type Reconnect = { subscribe: (listener: () => void) => () => void; getPreview: (edgeId: string) => DiagramReconnectPreview | null; start: (args: Start, event: ReactPointerEvent<SVGCircleElement>) => void }
export const DiagramReconnectContext = createContext<Reconnect | null>(null)
const subscribeNothing = () => () => {}
export function useDiagramReconnectPreview(edgeId: string) {
  const reconnect = useContext(DiagramReconnectContext)
  const snapshot = useCallback(() => reconnect?.getPreview(edgeId) ?? null, [reconnect, edgeId])
  return useSyncExternalStore(reconnect?.subscribe ?? subscribeNothing, snapshot, snapshot)
}
const DRAG_THRESHOLD_PX = 3
export function resolveDiagramReconnect(drag: Drag, client: { x: number; y: number }, nodes: Node[], toFlow: (p: { x: number; y: number }) => { x: number; y: number }, zoom: number) {
  const moved = Math.hypot(client.x - drag.startClient.x, client.y - drag.startClient.y) >= DRAG_THRESHOLD_PX
  const preview: DiagramReconnectPreview = { edgeId: drag.edgeId, source: drag.source, target: drag.target }
  if (!moved) return { preview, connection: null }
  const pointer = toFlow(client)
  const desired = { x: pointer.x - drag.grabOffset.x / zoom, y: pointer.y - drag.grabOffset.y / zoom }
  const moving = drag.movingEnd, fixed = moving === 'target' ? drag.source : drag.target
  const fixedNode = moving === 'target' ? drag.edge.source : drag.edge.target
  const anchor = magneticDiagramAnchor(desired, nodes, fixedNode, zoom)
  const point = anchor?.point ?? desired
  const position = anchor ? anchor.side as Position : connectionPreviewTargetPosition(fixed.x, fixed.y, point.x, point.y, drag[moving].position)
  preview[moving] = { ...point, position }
  const connection: Connection | null = !anchor ? null : moving === 'target'
    ? { source: drag.edge.source, sourceHandle: drag.edge.sourceHandle ?? null, target: anchor.nodeId, targetHandle: magneticAnchorHandle(anchor, 'target') }
    : { source: anchor.nodeId, sourceHandle: magneticAnchorHandle(anchor, 'source'), target: drag.edge.target, targetHandle: drag.edge.targetHandle ?? null }
  return { preview, connection }
}
/** Reconnect in place: keep the real edge mounted and preserve the cursor's grab offset. */
export function useDiagramReconnect(edges: Edge[], getNodes: () => Node[], toFlow: (p: { x: number; y: number }) => { x: number; y: number }, zoom: number,
  update?: (edge: Edge, connection: Connection) => void, validate?: (connection: Connection) => boolean, autoPan?: (point: { x: number; y: number }) => boolean | Promise<boolean>, viewportKey?: string) {
  const pending = useRef<Drag | null>(null)
  const latest = useRef({ edges, getNodes, toFlow, zoom, update, validate, autoPan })
  latest.current = { edges, getNodes, toFlow, zoom, update, validate, autoPan }
  const snapshot = useRef<DiagramReconnectPreview | null>(null)
  const listeners = useRef(new Set<() => void>())
  const [dragging, setDragging] = useState(false)
  const setPreview = useCallback((value: DiagramReconnectPreview | null) => {
    const activeChanged = Boolean(snapshot.current) !== Boolean(value)
    snapshot.current = value
    if (activeChanged) setDragging(Boolean(value))
    for (const listener of listeners.current) listener()
  }, [])
  const start = useCallback((args: Start, event: ReactPointerEvent<SVGCircleElement>) => {
    const current = latest.current
    if (pending.current || !current.update || event.button !== 0) return
    const edge = current.edges.find(item => item.id === args.edgeId)
    if (!edge) return
    event.preventDefault(); event.stopPropagation()
    const startClient = { x: event.clientX, y: event.clientY }
    const pointer = current.toFlow(startClient), point = args[args.movingEnd]
    pending.current = { ...args, edge, pointerId: event.pointerId, startClient, client: startClient,
      grabOffset: { x: (pointer.x - point.x) * current.zoom, y: (pointer.y - point.y) * current.zoom } }
    try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch { /* Window listeners also handle a released capture. */ }
    setPreview({ edgeId: args.edgeId, source: args.source, target: args.target })
  }, [])
  useEffect(() => {
    const cancel = () => { pending.current = null; setPreview(null) }
    const move = (event: PointerEvent) => {
      const drag = pending.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const current = latest.current
      drag.client = { x: event.clientX, y: event.clientY }
      setPreview(resolveDiagramReconnect(drag, drag.client, current.getNodes(), current.toFlow, current.zoom).preview)
    }
    const finish = (event: PointerEvent) => {
      const drag = pending.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const current = latest.current
      const { connection } = resolveDiagramReconnect(drag, { x: event.clientX, y: event.clientY }, current.getNodes(), current.toFlow, current.zoom)
      pending.current = null
      setPreview(null)
      const edge = current.edges.find(item => item.id === drag.edgeId)
      if (edge && connection && (!current.validate || current.validate(connection))) current.update?.(edge, connection)
    }
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && pending.current) { event.preventDefault(); cancel() } }
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', keyDown)
    return () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', keyDown)
    }
  }, [])
  useLayoutEffect(() => {
    const drag = pending.current, current = latest.current
    if (drag) setPreview(resolveDiagramReconnect(drag, drag.client, current.getNodes(), current.toFlow, current.zoom).preview)
  }, [viewportKey])
  useEffect(() => {
    if (!dragging || !latest.current.autoPan) return
    let stopped = false, frame = 0
    const tick = async () => {
      const drag = pending.current, current = latest.current
      if (!drag || stopped) return
      if (Math.hypot(drag.client.x - drag.startClient.x, drag.client.y - drag.startClient.y) >= DRAG_THRESHOLD_PX) {
        let moved = false
        try { moved = await current.autoPan?.(drag.client) ?? false } catch { /* A failed pan does not commit or cancel the connection. */ }
        if (moved && pending.current === drag && !stopped) {
          const now = latest.current
          setPreview(resolveDiagramReconnect(drag, drag.client, now.getNodes(), now.toFlow, now.zoom).preview)
        }
      }
      if (!stopped && pending.current) frame = window.requestAnimationFrame(() => { void tick() })
    }
    frame = window.requestAnimationFrame(() => { void tick() })
    return () => { stopped = true; window.cancelAnimationFrame(frame) }
  }, [dragging])
  return useMemo(() => ({ start,
    getPreview: (edgeId: string) => snapshot.current?.edgeId === edgeId ? snapshot.current : null,
    subscribe: (listener: () => void) => { listeners.current.add(listener); return () => { listeners.current.delete(listener) } },
  }), [start])
}
