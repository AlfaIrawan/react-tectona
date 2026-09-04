import { memo, useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  isEndLike,
  isEventNode,
  layoutFlowchartGraph,
  parseFlowchartFallback,
  type FallbackGraph,
} from '@/lib/chat/mermaidFallbackSvg'
import { cn } from '@/lib/utils'

export type AssistantFlowchartNodeData = {
  label: string
  kind: 'process' | 'event' | 'decision'
  isEnd: boolean
  direction: 'TD' | 'LR'
}

const PROCESS_NODE_STYLE = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  boxShadow: 'none',
}

function sourcePosition(direction: 'TD' | 'LR') {
  return direction === 'LR' ? Position.Right : Position.Bottom
}

function targetPosition(direction: 'TD' | 'LR') {
  return direction === 'LR' ? Position.Left : Position.Top
}

function ProcessNode({ data }: NodeProps<AssistantFlowchartNodeData>) {
  return (
    <div className="box-border flex h-full w-full items-center justify-center rounded-xl border-[1.6px] border-slate-900 bg-white px-3 py-2 text-center text-xs leading-snug text-slate-900">
      <Handle type="target" position={targetPosition(data.direction)} className="!h-2 !w-2 !opacity-0" />
      <span className="line-clamp-4">{data.label}</span>
      <Handle type="source" position={sourcePosition(data.direction)} className="!h-2 !w-2 !opacity-0" />
    </div>
  )
}

function EventNode({ data }: NodeProps<AssistantFlowchartNodeData>) {
  return (
    <div
      className={cn(
        'box-border flex h-full w-full items-center justify-center rounded-full border-slate-900 bg-white text-center text-[11px] text-slate-900',
        data.isEnd ? 'border-4' : 'border-[1.6px]',
      )}
    >
      <Handle type="target" position={targetPosition(data.direction)} className="!h-2 !w-2 !opacity-0" />
      <span className="px-1">{data.label}</span>
      <Handle type="source" position={sourcePosition(data.direction)} className="!h-2 !w-2 !opacity-0" />
    </div>
  )
}

const DECISION_HANDLE_CLASS = '!h-2 !w-2 !border-0 !bg-transparent !opacity-0'

function DecisionNode({ data }: NodeProps<AssistantFlowchartNodeData>) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-visible">
      <Handle type="target" id="target-top" position={Position.Top} className={DECISION_HANDLE_CLASS} />
      <Handle type="target" id="target-right" position={Position.Right} className={DECISION_HANDLE_CLASS} />
      <Handle type="target" id="target-bottom" position={Position.Bottom} className={DECISION_HANDLE_CLASS} />
      <Handle type="target" id="target-left" position={Position.Left} className={DECISION_HANDLE_CLASS} />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polygon
          points="50,2 98,50 50,98 2,50"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative z-10 max-w-[70%] px-1 text-center text-[11px] leading-snug text-slate-900">
        {data.label}
      </span>
      <Handle type="source" id="source-top" position={Position.Top} className={DECISION_HANDLE_CLASS} />
      <Handle type="source" id="source-right" position={Position.Right} className={DECISION_HANDLE_CLASS} />
      <Handle type="source" id="source-bottom" position={Position.Bottom} className={DECISION_HANDLE_CLASS} />
      <Handle type="source" id="source-left" position={Position.Left} className={DECISION_HANDLE_CLASS} />
    </div>
  )
}

type NodeBox = { x: number; y: number; w: number; h: number }

function boxCenter(box: NodeBox) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 }
}

function preferredDecisionSourceHandle(from: NodeBox, to: NodeBox): 'source-left' | 'source-right' | 'source-top' | 'source-bottom' {
  const a = boxCenter(from)
  const b = boxCenter(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'source-right' : 'source-left'
  }
  return dy >= 0 ? 'source-bottom' : 'source-top'
}

/** Decision diamonds never share one stem: each outgoing edge leaves a distinct vertex toward its target. */
function decisionSourceHandleByOutgoing(
  direction: 'TD' | 'LR',
  from: NodeBox,
  targets: Array<{ key: string; box: NodeBox }>,
): Map<string, string> {
  const assigned = new Map<string, string>()
  if (targets.length === 0) return assigned
  if (targets.length === 1) {
    assigned.set(targets[0].key, preferredDecisionSourceHandle(from, targets[0].box))
    return assigned
  }

  if (direction === 'TD') {
    const ordered = [...targets].sort((a, b) => boxCenter(a.box).x - boxCenter(b.box).x)
    if (ordered.length === 2) {
      assigned.set(ordered[0].key, 'source-left')
      assigned.set(ordered[1].key, 'source-right')
      return assigned
    }
    const slots: Array<'source-left' | 'source-bottom' | 'source-right'> = ['source-left', 'source-bottom', 'source-right']
    ordered.forEach((item, index) => {
      assigned.set(item.key, slots[Math.min(index, slots.length - 1)])
    })
    return assigned
  }

  const ordered = [...targets].sort((a, b) => boxCenter(a.box).y - boxCenter(b.box).y)
  if (ordered.length === 2) {
    assigned.set(ordered[0].key, 'source-top')
    assigned.set(ordered[1].key, 'source-bottom')
    return assigned
  }
  const slots: Array<'source-top' | 'source-right' | 'source-bottom'> = ['source-top', 'source-right', 'source-bottom']
  ordered.forEach((item, index) => {
    assigned.set(item.key, slots[Math.min(index, slots.length - 1)])
  })
  return assigned
}

const nodeTypes = {
  assistantProcess: ProcessNode,
  assistantEvent: EventNode,
  assistantDecision: DecisionNode,
}

function handleReactFlowError(messageId: string, message: string) {
  if (messageId === '002') return
  console.warn(message)
}

function graphToFlow(graph: FallbackGraph): { nodes: Node<AssistantFlowchartNodeData>[]; edges: Edge[]; height: number } {
  const { positions, height } = layoutFlowchartGraph(graph)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const nodes: Node<AssistantFlowchartNodeData>[] = graph.nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0, w: 280, h: 72 }
    const kind: AssistantFlowchartNodeData['kind'] =
      node.shape === 'diamond' ? 'decision' : isEventNode(node) ? 'event' : 'process'
    return {
      id: node.id,
      type: kind === 'decision' ? 'assistantDecision' : kind === 'event' ? 'assistantEvent' : 'assistantProcess',
      position: { x: pos.x, y: pos.y },
      data: {
        label: node.label,
        kind,
        isEnd: isEndLike(node),
        direction: graph.direction,
      },
      style: { ...PROCESS_NODE_STYLE, width: pos.w, height: pos.h },
      sourcePosition: sourcePosition(graph.direction),
      targetPosition: targetPosition(graph.direction),
      draggable: false,
      selectable: false,
    }
  })

  const decisionHandleByEdgeKey = new Map<string, string>()
  for (const node of graph.nodes) {
    if (node.shape !== 'diamond') continue
    const from = positions.get(node.id)
    if (!from) continue
    const outgoing = graph.edges
      .map((edge, index) => ({ edge, index, key: `${edge.source}-${edge.target}-${index}` }))
      .filter((item) => item.edge.source === node.id)
    const targets = outgoing.flatMap((item) => {
      const box = positions.get(item.edge.target)
      return box ? [{ key: item.key, box }] : []
    })
    const assigned = decisionSourceHandleByOutgoing(graph.direction, from, targets)
    for (const [key, handle] of assigned) decisionHandleByEdgeKey.set(key, handle)
  }

  const edges: Edge[] = graph.edges.map((edge, index) => {
    const key = `${edge.source}-${edge.target}-${index}`
    const sourceIsDecision = nodeById.get(edge.source)?.shape === 'diamond'
    const targetIsDecision = nodeById.get(edge.target)?.shape === 'diamond'
    return {
      id: key,
      source: edge.source,
      target: edge.target,
      sourceHandle: sourceIsDecision ? decisionHandleByEdgeKey.get(key) : undefined,
      targetHandle: targetIsDecision
        ? graph.direction === 'LR'
          ? 'target-left'
          : 'target-top'
        : undefined,
      label: edge.label,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#111827', width: 18, height: 18 },
      style: { stroke: '#111827', strokeWidth: 1.8 },
      labelStyle: { fontSize: 11, fill: '#475569' },
    }
  })
  return { nodes, edges, height }
}

type AssistantFlowchartCanvasProps = {
  source: string
  className?: string
  height?: number
  showControls?: boolean
}

function AssistantFlowchartCanvasInner({ source, className, height, showControls = true }: AssistantFlowchartCanvasProps) {
  const graph = useMemo(() => parseFlowchartFallback(source), [source])
  const flow = useMemo(() => (graph ? graphToFlow(graph) : null), [graph])
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!flow || flow.nodes.length === 0) return
    const timer = window.setTimeout(() => fitView({ padding: 0.18, duration: 180 }), 40)
    return () => window.clearTimeout(timer)
  }, [fitView, flow])

  if (!flow) {
    return (
      <div
        className={cn('flex items-center justify-center text-xs text-slate-500', height == null && 'h-full', className)}
        style={height != null ? { height } : undefined}
      >
        Diagram could not be parsed
      </div>
    )
  }

  return (
    <div
      className={cn('w-full min-w-0 bg-white', height == null && 'h-full', className)}
      style={height != null ? { height } : undefined}
    >
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        onError={handleReactFlowError}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.8}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        preventScrolling
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        className="h-full w-full"
      >
        <Background id="assistant-flow-grid" variant={BackgroundVariant.Dots} color="#e2e8f0" gap={18} size={1} />
        {showControls ? <Controls showInteractive={false} position="bottom-left" /> : null}
      </ReactFlow>
    </div>
  )
}

function AssistantFlowchartCanvasRoot(props: AssistantFlowchartCanvasProps) {
  return (
    <ReactFlowProvider>
      <AssistantFlowchartCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

export function flowchartPreviewHeight(source: string): number {
  const graph = parseFlowchartFallback(source)
  if (!graph) return 280
  const { height } = layoutFlowchartGraph(graph)
  return Math.min(560, Math.max(260, height + 24))
}

export function canRenderAssistantFlowchart(source: string): boolean {
  return parseFlowchartFallback(source) != null
}

export const AssistantFlowchartCanvas = memo(AssistantFlowchartCanvasRoot)
