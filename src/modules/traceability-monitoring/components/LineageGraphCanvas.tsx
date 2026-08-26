import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Maximize2, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import type { LineageEdgeApi, LineageNodeApi } from '@/lib/api/traceabilityMonitoringApi'
import {
  lineageEntityStyle,
  layoutLineageGraph,
  type LineageFlowNodeData,
} from '@/modules/traceability-monitoring/lib/lineageLayout'
import { LineageEntityNode } from '@/modules/traceability-monitoring/components/LineageNode'

const ROOT_TYPE_OPTIONS = ['idea', 'project', 'work_item', 'document', 'approval', 'workspace']
const MAX_DEPTH = 4
const nodeTypes = { lineageEntity: LineageEntityNode }

export interface LineageRootDraft {
  rootType: string
  rootId: string
}

interface LineageGraphCanvasProps {
  nodes: LineageNodeApi[]
  edges: LineageEdgeApi[]
  rootType: string
  rootId: string
  depth: number
  truncated: boolean
  loading: boolean
  error: string | null
  onSubmitRoot: (draft: LineageRootDraft) => void
  onDepthChange: (depth: number) => void
  onSelectNode: (entityType: string, entityId: string) => void
  emptyMessage?: string
}

function LineageGraphCanvasInner(props: LineageGraphCanvasProps) {
  const { nodes, edges, rootType, rootId, depth, truncated, loading, error, onSubmitRoot, onDepthChange, onSelectNode, emptyMessage } =
    props
  const { fitView } = useReactFlow()

  // Toolbar inputs are edited independently of the committed root, but resync
  // when the committed root changes elsewhere (e.g. "Show in lineage"). Adjusted
  // during render (React's recommended pattern) rather than in an effect.
  const [committedRootKey, setCommittedRootKey] = useState(`${rootType}:${rootId}`)
  const [draftType, setDraftType] = useState(rootType)
  const [draftId, setDraftId] = useState(rootId)
  const rootKeyNow = `${rootType}:${rootId}`
  if (rootKeyNow !== committedRootKey) {
    setCommittedRootKey(rootKeyNow)
    setDraftType(rootType)
    setDraftId(rootId)
  }

  const flowNodes = useMemo<Node<LineageFlowNodeData>[]>(() => {
    const rootKey = `${rootType}:${rootId}`
    return layoutLineageGraph(nodes, edges, rootKey)
  }, [nodes, edges, rootType, rootId])

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        type: 'smoothstep',
        style: { stroke: '#94a3b8' },
        labelStyle: { fontSize: 10, fill: '#64748b' },
      })),
    [edges],
  )

  useEffect(() => {
    if (flowNodes.length > 0) {
      const timer = window.setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 30)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [flowNodes, fitView])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!draftId.trim()) return
      onSubmitRoot({ rootType: draftType, rootId: draftId.trim() })
    },
    [draftType, draftId, onSubmitRoot],
  )

  return (
    <div className="relative h-full min-h-[320px] w-full min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.22)_1px,transparent_1px)] [background-size:22px_22px]">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          const [entityType, ...rest] = node.id.split(':')
          onSelectNode(entityType, rest.join(':'))
        }}
        className="h-full w-full"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background color="#cbd5e1" gap={22} />
        <Controls showInteractive={false} />
        <MiniMap
          zoomable
          pannable
          nodeColor={(node) => lineageEntityStyle((node.data as LineageFlowNodeData)?.entityType ?? '').accent}
          maskColor="rgba(15, 23, 42, 0.08)"
          className="!border !border-slate-200 !bg-white/95"
        />
      </ReactFlow>

      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto absolute left-3 top-3 z-10 flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card/95 p-2.5 shadow-md backdrop-blur"
      >
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Root type
          <Select value={draftType} onChange={(e) => setDraftType(e.target.value)} className="h-8 w-32">
            {ROOT_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Root ID
          <Input
            className="h-8 w-40"
            placeholder="entity id"
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Depth
          <Select value={String(depth)} onChange={(e) => onDepthChange(Number(e.target.value))} className="h-8 w-16">
            {Array.from({ length: MAX_DEPTH }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}
              </SelectItem>
            ))}
          </Select>
        </label>
        <Button type="submit" size="sm" className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Load
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fitView({ padding: 0.2, duration: 200 })}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Fit view
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => onSubmitRoot({ rootType, rootId })}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </form>

      {truncated ? (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          Graph truncated at the max node limit — narrow the root or depth to see more detail.
        </div>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/40 text-sm text-muted-foreground backdrop-blur-sm dark:bg-slate-950/40">
          Loading lineage graph…
        </div>
      ) : null}

      {!loading && error ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/70 text-center dark:bg-slate-950/70">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => onSubmitRoot({ rootType, rootId })}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error && nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {emptyMessage ?? 'No lineage recorded for this root entity yet.'}
          </p>
          <p className="text-xs text-muted-foreground/80">
            Pick a root type/ID above, then Load — or check back after related activity occurs.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function LineageGraphCanvas(props: LineageGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <LineageGraphCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
