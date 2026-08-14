import { Handle, Position, type NodeProps } from 'reactflow'
import { cn } from '@/lib/utils'
import { lineageEntityStyle, type LineageFlowNodeData } from '@/modules/traceability-monitoring/lib/lineageLayout'

const handleClassName = '!h-2 !w-2 !border-0 !bg-slate-400 !opacity-60'

export function LineageEntityNode({ data, selected }: NodeProps<LineageFlowNodeData>) {
  const style = lineageEntityStyle(data.entityType)

  return (
    <div
      className={cn(
        'w-[220px] rounded-2xl border bg-white/95 px-3.5 py-3 shadow-sm transition-shadow dark:bg-slate-900/95',
        selected ? 'shadow-lg ring-2 ring-offset-1' : 'shadow-sm'
      )}
      style={{
        borderColor: style.accent,
        ...(selected ? ({ '--tw-ring-color': style.accent } as Record<string, string>) : {}),
      }}
    >
      <Handle type="target" position={Position.Left} className={handleClassName} />
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ backgroundColor: style.chipBg, color: style.chipText }}
      >
        {style.label}
      </span>
      <div className="mt-1.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={data.label}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className={handleClassName} />
    </div>
  )
}
