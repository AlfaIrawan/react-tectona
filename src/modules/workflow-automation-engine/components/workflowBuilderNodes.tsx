import { Handle, Position, type NodeProps } from 'reactflow'
import { cn } from '@/lib/utils'
import {
  WORKFLOW_KIND_META,
  workflowNodeSummary,
  type WorkflowNodeData,
} from '@/modules/workflow-automation-engine/components/workflowNodeKinds'

const HANDLE_BASE_CLASS = '!h-3 !w-3 !rounded-full !border-2 !border-white'

// A single card component renders every kind; the kind drives the accent,
// icon, and handle layout. Registered under one nodeTypes key per kind so
// React Flow keeps stable types (mirrors the integration canvas pattern).
export function WorkflowBuilderNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  const meta = WORKFLOW_KIND_META[data.kind]
  const Icon = meta.icon
  const summary = workflowNodeSummary(data)
  const isTrigger = data.kind === 'trigger'
  const isEnd = data.kind === 'end'
  const isBranch = data.kind === 'ifElse'
  const isParallel = data.kind === 'parallel'
  const isLoop = data.kind === 'loop'
  const isDisabled = data.disabled === true

  return (
    <div
      className={cn(
        'relative w-[224px] overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow',
        selected ? 'border-slate-900 shadow-lg ring-2 ring-slate-900/10' : 'border-slate-200 hover:shadow-md',
        isDisabled && 'opacity-50',
      )}
    >
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
          position={Position.Top}
          className={HANDLE_BASE_CLASS}
          style={{ background: meta.accent }}
        />
      ) : null}

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
        <div className="flex items-center justify-between px-4 pb-2 text-[10px] font-semibold">
          <span className={isBranch ? 'text-emerald-600' : 'text-blue-600'}>{isBranch ? 'TRUE' : isParallel ? 'BRANCH A' : 'BODY'}</span>
          <span className={isBranch ? 'text-rose-500' : 'text-indigo-500'}>{isBranch ? 'FALSE' : isParallel ? 'BRANCH B' : 'DONE'}</span>
        </div>
      ) : null}

      {isBranch ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            className={HANDLE_BASE_CLASS}
            style={{ background: '#10b981', left: '22%' }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            className={HANDLE_BASE_CLASS}
            style={{ background: '#ef4444', left: '78%' }}
          />
        </>
      ) : isParallel ? (
        <>
          <Handle
            id="branchA"
            type="source"
            position={Position.Bottom}
            className={HANDLE_BASE_CLASS}
            style={{ background: '#2563eb', left: '22%' }}
          />
          <Handle
            id="branchB"
            type="source"
            position={Position.Bottom}
            className={HANDLE_BASE_CLASS}
            style={{ background: '#4f46e5', left: '78%' }}
          />
        </>
      ) : isLoop ? (
        <>
          <Handle id="body" type="source" position={Position.Bottom} className={HANDLE_BASE_CLASS} style={{ background: '#14b8a6', left: '22%' }} />
          <Handle id="done" type="source" position={Position.Bottom} className={HANDLE_BASE_CLASS} style={{ background: '#64748b', left: '78%' }} />
        </>
      ) : !isEnd ? (
        <Handle
          id="out"
          type="source"
          position={Position.Bottom}
          className={HANDLE_BASE_CLASS}
          style={{ background: meta.accent }}
        />
      ) : null}
    </div>
  )
}
