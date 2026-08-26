import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps, type NodeTypes } from 'reactflow'
import { useEffect, type CSSProperties } from 'react'
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

const RESIZER_LINE_STYLE: CSSProperties = {
  borderColor: '#0ea5e9',
  borderWidth: 1.5,
}

const RESIZER_HANDLE_STYLE: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 3,
  border: '1.5px solid #0ea5e9',
  background: '#ffffff',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)',
}

function SelectionResizer({
  selected,
  minWidth,
  minHeight,
}: {
  selected: boolean
  minWidth: number
  minHeight: number
}) {
  return (
    <NodeResizer
      isVisible={selected}
      minWidth={minWidth}
      minHeight={minHeight}
      lineStyle={RESIZER_LINE_STYLE}
      handleStyle={RESIZER_HANDLE_STYLE}
    />
  )
}

function ConnectionHandles({ nodeId, selected }: { nodeId: string; selected: boolean }) {
  const updateNodeInternals = useUpdateNodeInternals()
  const visibleHandleClass = [
    '!flex !h-4 !w-4 !items-center !justify-center !border-0 !bg-transparent',
    '!pointer-events-auto !z-30 !cursor-crosshair',
    '!opacity-0 !transition-opacity !duration-150',
    'group-hover:!opacity-100',
    selected ? '!opacity-100' : '',
  ].join(' ')
  const legacyTargetClass = '!pointer-events-none !h-2 !w-2 !border-0 !opacity-0'
  const extraOffsets = [20, 40, 60, 80]
  const anchorDot = <span className="pointer-events-none block h-2 w-2 rounded-full border border-white bg-sky-500 shadow-[0_1px_5px_rgba(14,165,233,0.45)]" />

  useEffect(() => {
    updateNodeInternals(nodeId)
  }, [nodeId, updateNodeInternals])

  return (
    <>
      <Handle id="target-left" type="target" position={Position.Left} className={legacyTargetClass} />
      <Handle id="target-top" type="target" position={Position.Top} className={legacyTargetClass} />
      <Handle id="target-right" type="target" position={Position.Right} className={legacyTargetClass} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={legacyTargetClass} />

      <Handle id="source-left" type="source" position={Position.Left} isConnectable isConnectableStart isConnectableEnd className={visibleHandleClass}>{anchorDot}</Handle>
      <Handle id="source-top" type="source" position={Position.Top} isConnectable isConnectableStart isConnectableEnd className={visibleHandleClass}>{anchorDot}</Handle>
      <Handle id="source-right" type="source" position={Position.Right} isConnectable isConnectableStart isConnectableEnd className={visibleHandleClass}>{anchorDot}</Handle>
      <Handle id="source-bottom" type="source" position={Position.Bottom} isConnectable isConnectableStart isConnectableEnd className={visibleHandleClass}>{anchorDot}</Handle>

      {extraOffsets.map((offset) => (
        <Handle
          key={`top-${offset}`}
          id={`source-top-${offset}`}
          type="source"
          position={Position.Top}
          isConnectable
          isConnectableStart
          isConnectableEnd
          className={visibleHandleClass}
          style={{ left: `${offset}%` }}
        >
          {anchorDot}
        </Handle>
      ))}
      {extraOffsets.map((offset) => (
        <Handle
          key={`right-${offset}`}
          id={`source-right-${offset}`}
          type="source"
          position={Position.Right}
          isConnectable
          isConnectableStart
          isConnectableEnd
          className={visibleHandleClass}
          style={{ top: `${offset}%` }}
        >
          {anchorDot}
        </Handle>
      ))}
      {extraOffsets.map((offset) => (
        <Handle
          key={`bottom-${offset}`}
          id={`source-bottom-${offset}`}
          type="source"
          position={Position.Bottom}
          isConnectable
          isConnectableStart
          isConnectableEnd
          className={visibleHandleClass}
          style={{ left: `${offset}%` }}
        >
          {anchorDot}
        </Handle>
      ))}
      {extraOffsets.map((offset) => (
        <Handle
          key={`left-${offset}`}
          id={`source-left-${offset}`}
          type="source"
          position={Position.Left}
          isConnectable
          isConnectableStart
          isConnectableEnd
          className={visibleHandleClass}
          style={{ top: `${offset}%` }}
        >
          {anchorDot}
        </Handle>
      ))}
    </>
  )
}

export function ArchimateElementNode({ id, data, selected }: NodeProps<ArchimateElementNodeData>) {
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

  return (
    <div className="group relative h-full w-full">
      <SelectionResizer selected={selected} minWidth={100} minHeight={56} />
      <ConnectionHandles nodeId={id} selected={selected} />

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

    </div>
  )
}

export function ArchimateBoundaryNode({ id, data, selected }: NodeProps<ArchimateBoundaryNodeData>) {
  const boxStyle = buildIntegrationNodeBoxStyle({
    ...data.visual,
    lineStyle: data.visual?.lineStyle ?? 'dashed',
    fillEnabled: data.visual?.fillEnabled ?? true,
    fillColor: data.visual?.fillColor ?? 'rgba(255,255,255,0.15)',
    lineColor: data.visual?.lineColor ?? 'rgba(100,116,139,0.8)',
    rounded: data.visual?.rounded ?? true,
  })
  return (
    <div className="group relative h-full w-full">
      <SelectionResizer selected={selected} minWidth={180} minHeight={120} />
      <ConnectionHandles nodeId={id} selected={selected} />
      <div className="h-full w-full border-2 px-4 py-3" style={boxStyle}>
        <p className="text-xs font-semibold text-slate-600">{data.title}</p>
      </div>
    </div>
  )
}

export function ArchimateNoteNode({ id, data, selected }: NodeProps<ArchimateNoteNodeData>) {
  const boxStyle = buildIntegrationNodeBoxStyle({
    ...data.visual,
    fillEnabled: data.visual?.fillEnabled ?? true,
    fillColor: data.visual?.fillColor ?? 'rgba(255,255,255,0.88)',
    lineColor: data.visual?.lineColor ?? '#e2e8f0',
    shadow: data.visual?.shadow ?? true,
    rounded: data.visual?.rounded ?? true,
  })
  return (
    <div className="group relative h-full w-full">
      <SelectionResizer selected={selected} minWidth={160} minHeight={60} />
      <ConnectionHandles nodeId={id} selected={selected} />
      <div className="h-full w-full border px-4 py-3" style={boxStyle}>
        <p className="text-xs font-semibold text-slate-900">{data.title}</p>
        {data.lines.map((line) => (
          <p key={line} className="mt-1 text-[11px] leading-4 text-slate-600">
            {line}
          </p>
        ))}
      </div>
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
