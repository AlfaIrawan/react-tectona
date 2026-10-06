import { Handle, Position, useStore, type Node, type NodeProps } from 'reactflow'
import type { CSSProperties } from 'react'
import { NodeResizer } from '@reactflow/node-resizer'
import '@reactflow/node-resizer/dist/style.css'
import { cn } from '@/lib/utils'
import {
  WORKFLOW_KIND_META,
  workflowNodeSummary,
  type WorkflowNodeData,
} from '@/modules/workflow-automation-engine/components/workflowNodeKinds'
import { workflowEdgeEndpoints, workflowPerimeterPorts, type WorkflowEdgeEndpoints } from '@/modules/workflow-automation-engine/components/workflowEdgeGeometry'

const HANDLE_BASE_CLASS = '!z-20 !h-3 !w-3 !rounded-full !border-2 !border-white !opacity-0 transition-opacity group-hover:!opacity-100'
const RESIZER_LINE_STYLE = { borderColor: '#0ea5e9', borderWidth: 1.5 }
const RESIZER_HANDLE_STYLE = {
  width: 10,
  height: 10,
  borderRadius: 3,
  border: '1.5px solid #0ea5e9',
  background: '#ffffff',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)',
}

function connectedHandleStyle(
  color: string,
  endpoint: WorkflowEdgeEndpoints['source'] | WorkflowEdgeEndpoints['target'] | null,
  node: Node | undefined,
  fallbackPercent?: number,
): CSSProperties {
  if (!endpoint || !node) {
    return fallbackPercent == null ? { background: color } : { background: color, left: `${fallbackPercent}%` }
  }
  const origin = node.positionAbsolute ?? node.position
  const width = Number(node.width ?? 224)
  const height = Number(node.height ?? 78)
  if (endpoint.position === Position.Top || endpoint.position === Position.Bottom) {
    return { background: color, left: `${Math.max(0, Math.min(100, ((endpoint.x - origin.x) / width) * 100))}%` }
  }
  return { background: color, top: `${Math.max(0, Math.min(100, ((endpoint.y - origin.y) / height) * 100))}%` }
}

// A single card component renders every kind; the kind drives the accent,
// icon, and handle layout. Registered under one nodeTypes key per kind so
// React Flow keeps stable types (mirrors the integration canvas pattern).
export function WorkflowBuilderNode({ id, data, selected, width, height }: NodeProps<WorkflowNodeData>) {
  const meta = WORKFLOW_KIND_META[data.kind]
  const Icon = meta.icon
  const summary = workflowNodeSummary(data)
  const isTrigger = data.kind === 'trigger'
  const isEnd = data.kind === 'end'
  // An approval branches too: the green handle is taken when approved, the red one when
  // rejected (draw it to a 'back to draft' step, or leave it to fail the run).
  const isBranch = data.kind === 'ifElse' || data.kind === 'approval'
  const isApproval = data.kind === 'approval'
  const isParallel = data.kind === 'parallel'
  const isLoop = data.kind === 'loop'
  const isDisabled = data.disabled === true
  const minHeight = isBranch || isParallel || isLoop ? 104 : 78
  const handleClass = cn(HANDLE_BASE_CLASS, selected && '!opacity-100')
  const perimeterPortClass = cn(
    '!z-30 !h-2 !w-2 !rounded-full !border !border-white !bg-sky-500 !opacity-0 transition-opacity group-hover:!opacity-100',
    selected && '!opacity-100',
  )
  const edges = useStore((state) => state.edges)
  const nodeInternals = useStore((state) => state.nodeInternals)
  const hasRelation = (handleId: string) => edges.some(
    (edge) => edge.source === id && (edge.sourceHandle ?? 'out') === handleId,
  )
  const sourceEndpoint = (handleId: string) => {
    const edge = edges.find((item) => item.source === id && (item.sourceHandle ?? 'out') === handleId)
    return edge ? workflowEdgeEndpoints(edge, nodeInternals, edges)?.source ?? null : null
  }
  const targetEndpoint = () => {
    const edge = edges.find((item) => item.target === id)
    return edge ? workflowEdgeEndpoints(edge, nodeInternals, edges)?.target ?? null : null
  }
  const currentNode = nodeInternals.get(id)
  const nodeWidth = Number(currentNode?.width ?? width ?? 224)
  const nodeHeight = Number(currentNode?.height ?? height ?? minHeight)
  const ports = workflowPerimeterPorts(nodeWidth, nodeHeight).map((port) => ({
    ...port,
    position: port.side === 'top' ? Position.Top : port.side === 'right' ? Position.Right : port.side === 'bottom' ? Position.Bottom : Position.Left,
    style: (port.side === 'top' || port.side === 'bottom'
      ? { left: `${port.ratio * 100}%` }
      : { top: `${port.ratio * 100}%` }) as CSSProperties,
  }))
  const inputEndpoint = targetEndpoint()
  const trueEndpoint = sourceEndpoint('true')
  const falseEndpoint = sourceEndpoint('false')
  const branchAEndpoint = sourceEndpoint('branchA')
  const branchBEndpoint = sourceEndpoint('branchB')
  const branchCEndpoint = sourceEndpoint('branchC')
  const branchDEndpoint = sourceEndpoint('branchD')
  const bodyEndpoint = sourceEndpoint('body')
  const doneEndpoint = sourceEndpoint('done')
  const outputEndpoint = sourceEndpoint('out')
  const primaryHandle = isBranch ? 'true' : isParallel ? 'branchA' : 'body'
  const secondaryHandle = isBranch ? 'false' : isParallel ? 'branchB' : 'done'

  return (
    <div className={cn('group relative h-full w-full', isDisabled && 'opacity-50')}>
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={minHeight}
        lineStyle={RESIZER_LINE_STYLE}
        handleStyle={RESIZER_HANDLE_STYLE}
      />

      <div className={cn(
        'relative h-full min-h-[78px] w-full overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow',
        selected ? 'border-slate-900 shadow-lg ring-2 ring-slate-900/10' : 'border-slate-200 hover:shadow-md',
      )}>
        <div className="h-1.5 w-full" style={{ background: meta.accent }} />

      {isDisabled ? (
        <span
          className="absolute left-2 top-3 z-10 rounded-full bg-slate-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow"
          title="This node is skipped at run time"
        >
          Disabled
        </span>
      ) : null}

      {data._issue ? (
        <span
          className={cn(
            'absolute right-2 top-3 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full text-white shadow',
            data._issue === 'error' ? 'bg-rose-500' : 'bg-amber-500',
          )}
          title={data._issue === 'error' ? 'Has a blocking issue' : 'Has a warning'}
        >
          <span className="text-[10px] font-bold leading-none">!</span>
        </span>
      ) : null}

        {!isTrigger ? (
          <Handle
            id="in"
            type="target"
            position={inputEndpoint?.position ?? Position.Top}
            className={handleClass}
            style={connectedHandleStyle(meta.accent, inputEndpoint, currentNode)}
          />
        ) : null}

        {ports.map((port) => (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={port.position}
            className={perimeterPortClass}
            style={port.style}
            title="Drag to create a connection"
          />
        ))}

        <div className="flex items-start gap-2.5 px-3 py-3">
        <span
          className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1', meta.chipClass)}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{meta.label}</div>
          <div className="truncate text-sm font-semibold text-slate-900">{data.label}</div>
          <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-500">{summary}</div>
        </div>
        </div>

        {isBranch || isParallel || isLoop ? (
          <div className="relative h-6 pb-2 text-[10px] font-semibold">
            {!hasRelation(primaryHandle) ? (
              <span className={cn('absolute left-[22%] -translate-x-1/2 whitespace-nowrap', isBranch ? 'text-emerald-600' : 'text-blue-600')}>
                {isApproval ? 'APPROVED' : isBranch ? 'TRUE' : isParallel ? 'BRANCH A' : 'BODY'}
              </span>
            ) : null}
            {!hasRelation(secondaryHandle) ? (
              <span className={cn(
                'absolute -translate-x-1/2 whitespace-nowrap',
                isParallel ? 'left-[38%] text-indigo-500' : 'left-[78%]',
                isBranch && 'text-rose-500',
              )}>
                {isApproval ? 'REJECTED' : isBranch ? 'FALSE' : isParallel ? 'BRANCH B' : 'DONE'}
              </span>
            ) : null}
            {isParallel && !hasRelation('branchC') ? (
              <span className="absolute left-[62%] -translate-x-1/2 whitespace-nowrap text-violet-600">BRANCH C</span>
            ) : null}
            {isParallel && !hasRelation('branchD') ? (
              <span className="absolute left-[88%] -translate-x-1/2 whitespace-nowrap text-cyan-700">BRANCH D</span>
            ) : null}
          </div>
        ) : null}

        {isBranch ? (
          <>
            <Handle
              id="true"
              type="source"
              position={trueEndpoint?.position ?? Position.Bottom}
              className={handleClass}
              style={connectedHandleStyle('#10b981', trueEndpoint, currentNode, 22)}
            />
            <Handle
              id="false"
              type="source"
              position={falseEndpoint?.position ?? Position.Bottom}
              className={handleClass}
              style={connectedHandleStyle('#ef4444', falseEndpoint, currentNode, 78)}
            />
          </>
        ) : isParallel ? (
          <>
            <Handle
              id="branchA"
              type="source"
              position={branchAEndpoint?.position ?? Position.Bottom}
              className={handleClass}
              style={connectedHandleStyle('#2563eb', branchAEndpoint, currentNode, 22)}
            />
            <Handle
              id="branchB"
              type="source"
              position={branchBEndpoint?.position ?? Position.Bottom}
              className={handleClass}
              style={connectedHandleStyle('#4f46e5', branchBEndpoint, currentNode, 38)}
            />
            <Handle
              id="branchC"
              type="source"
              position={branchCEndpoint?.position ?? Position.Bottom}
              className={handleClass}
              style={connectedHandleStyle('#7c3aed', branchCEndpoint, currentNode, 62)}
            />
            <Handle
              id="branchD"
              type="source"
              position={branchDEndpoint?.position ?? Position.Bottom}
              className={handleClass}
              style={connectedHandleStyle('#0891b2', branchDEndpoint, currentNode, 88)}
            />
          </>
        ) : isLoop ? (
          <>
            <Handle id="body" type="source" position={bodyEndpoint?.position ?? Position.Bottom} className={handleClass} style={connectedHandleStyle('#14b8a6', bodyEndpoint, currentNode, 22)} />
            <Handle id="done" type="source" position={doneEndpoint?.position ?? Position.Bottom} className={handleClass} style={connectedHandleStyle('#64748b', doneEndpoint, currentNode, 78)} />
          </>
        ) : !isEnd ? (
          <Handle
            id="out"
            type="source"
            position={outputEndpoint?.position ?? Position.Bottom}
            className={handleClass}
            style={connectedHandleStyle(meta.accent, outputEndpoint, currentNode)}
          />
        ) : null}
      </div>
    </div>
  )
}
