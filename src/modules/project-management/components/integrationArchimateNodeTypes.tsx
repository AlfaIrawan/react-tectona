import { Handle, Position, type NodeProps, type NodeTypes } from 'reactflow'
import type { CSSProperties } from 'react'
import {
  buildIntegrationNodeBoxStyle,
} from '@/modules/project-management/lib/integrationNodeAppearance'
import {
  ARCHIMATE_NOTATION_LAYER_COLORS,
  getArchimateLayerFillBackground,
  getArchimateNotationImageUrl,
} from '@/modules/project-management/lib/integrationArchimateNotationCatalog'
import type {
  ArchimateBoundaryNodeData,
  ArchimateElementNodeData,
  ArchimateNoteNodeData,
} from '@/modules/project-management/lib/integrationArchitectureTypes'

export function ArchimateElementNode({ data }: NodeProps<ArchimateElementNodeData>) {
  const resolvedVisual = data.visual
  const layerFill = getArchimateLayerFillBackground(
    data.layer,
    resolvedVisual?.fillColor,
    resolvedVisual?.fillEnabled ?? true,
  )
  const baseBoxStyle = buildIntegrationNodeBoxStyle(data.visual, data.layer)
  const boxStyle: CSSProperties = {
    ...baseBoxStyle,
    ...(layerFill.background
      ? { background: layerFill.background, backgroundColor: 'transparent' }
      : { backgroundColor: layerFill.backgroundColor ?? baseBoxStyle.backgroundColor }),
  }
  const notationImageUrl = getArchimateNotationImageUrl(data.notationId)
  const handleClassName = '!h-2 !w-2 !border-0 !bg-slate-600 !opacity-0'

  return (
    <div className="relative h-full w-full">
      <Handle id="target-left" type="target" position={Position.Left} className={handleClassName} />
      <Handle id="target-top" type="target" position={Position.Top} className={handleClassName} />
      <Handle id="target-right" type="target" position={Position.Right} className={handleClassName} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClassName} />

      <div className="relative h-full w-full overflow-hidden border" style={boxStyle}>
        {notationImageUrl ? (
          <img
            src={notationImageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute right-2 top-2 z-[1] h-8 w-8 object-contain"
          />
        ) : null}
        <div className="flex min-h-[78px] h-full w-full flex-col items-center justify-center px-4 py-4 pr-11 text-center">
          <p className="text-[13px] font-semibold leading-tight">{data.title}</p>
          {data.description.map((line) => (
            <p key={line} className="mt-1 text-[11px] leading-4 text-slate-600">
              {line}
            </p>
          ))}
        </div>
      </div>

      <Handle id="source-left" type="source" position={Position.Left} className={handleClassName} />
      <Handle id="source-top" type="source" position={Position.Top} className={handleClassName} />
      <Handle id="source-right" type="source" position={Position.Right} className={handleClassName} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClassName} />
    </div>
  )
}

export function ArchimateBoundaryNode({ data }: NodeProps<ArchimateBoundaryNodeData>) {
  const boxStyle = buildIntegrationNodeBoxStyle({
    ...data.visual,
    lineStyle: data.visual?.lineStyle ?? 'dashed',
    fillEnabled: data.visual?.fillEnabled ?? true,
    fillColor: data.visual?.fillColor ?? 'rgba(255,255,255,0.15)',
    lineColor: data.visual?.lineColor ?? 'rgba(100,116,139,0.8)',
    rounded: data.visual?.rounded ?? true,
  })
  return (
    <div className="h-full w-full border-2 px-4 py-3" style={boxStyle}>
      <p className="text-xs font-semibold text-slate-600">{data.title}</p>
    </div>
  )
}

export function ArchimateNoteNode({ data }: NodeProps<ArchimateNoteNodeData>) {
  const boxStyle = buildIntegrationNodeBoxStyle({
    ...data.visual,
    fillEnabled: data.visual?.fillEnabled ?? true,
    fillColor: data.visual?.fillColor ?? 'rgba(255,255,255,0.88)',
    lineColor: data.visual?.lineColor ?? '#e2e8f0',
    shadow: data.visual?.shadow ?? true,
    rounded: data.visual?.rounded ?? true,
  })
  return (
    <div className="h-full w-full border px-4 py-3" style={boxStyle}>
      <p className="text-xs font-semibold text-slate-900">{data.title}</p>
      {data.lines.map((line) => (
        <p key={line} className="mt-1 text-[11px] leading-4 text-slate-600">
          {line}
        </p>
      ))}
    </div>
  )
}

export function ArchimateLegendNode() {
  return (
    <div className="h-full w-full rounded-[18px] border border-slate-200 bg-white/92 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-900">Legend Inside Canvas</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
        <span className="rounded-lg border border-[#455A64] bg-[#FFF3B0] px-3 py-1 font-semibold text-slate-900">Business Role</span>
        <span className="rounded-lg border border-[#455A64] bg-[#C8EEF9] px-3 py-1 font-semibold text-slate-900">App Component / Service</span>
        <span className="rounded-lg border border-[#455A64] bg-[#C8EEF9] px-3 py-1 font-semibold text-slate-900">Data Object</span>
        <span className="rounded-lg border border-[#455A64] bg-[#C8F0C8] px-3 py-1 font-semibold text-slate-900">Technology Node</span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 bg-slate-900" />
          Serving
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 border-t-2 border-dashed border-slate-600" />
          Flow
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 border-t-2 border-dotted border-slate-500" />
          Access
        </span>
        <span className="rounded-lg border border-slate-300 border-dashed px-3 py-1 font-semibold text-slate-900">Boundary / Grouping</span>
        <span>ArchiMate-inspired notation</span>
      </div>
    </div>
  )
}

export const integrationArchimateNodeTypes: NodeTypes = {
  archimateElement: ArchimateElementNode,
  archimateBoundary: ArchimateBoundaryNode,
  archimateNote: ArchimateNoteNode,
  archimateLegend: ArchimateLegendNode,
}
