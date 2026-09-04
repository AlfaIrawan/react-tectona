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

function DecisionNode({ data }: NodeProps<AssistantFlowchartNodeData>) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-visible">
      <Handle type="target" position={targetPosition(data.direction)} className="!h-2 !w-2 !opacity-0" />
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
      <Handle type="source" position={sourcePosition(data.direction)} className="!h-2 !w-2 !opacity-0" />
    </div>
  )
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
  const edges: Edge[] = graph.edges.map((edge, index) => ({
    id: `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#111827', width: 18, height: 18 },
    style: { stroke: '#111827', strokeWidth: 1.8 },
    labelStyle: { fontSize: 11, fill: '#475569' },
  }))
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
