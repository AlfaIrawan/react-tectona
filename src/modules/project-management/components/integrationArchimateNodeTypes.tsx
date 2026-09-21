import { Handle, NodeResizer, Position, useReactFlow, useStore, useUpdateNodeInternals, type NodeProps, type NodeTypes } from 'reactflow'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Library, Link2 } from 'lucide-react'
import {
  buildIntegrationNodeBoxStyle,
  buildIntegrationNodeTextStyle,
  resolveNodeTextStyle,
} from '@/modules/project-management/lib/integrationNodeAppearance'
import { getArchimateLayerFillBackground, getArchimateNotationImageUrl } from '@/modules/project-management/lib/integrationArchimateNotationCatalog'
import { connectionHandlePercentsForLength } from '@/modules/project-management/lib/parsePlantUmlToIntegrationGraph'
import { bpmnResolvedLineColor, classifyBpmnType, isBpmnSquareShape } from '@/modules/project-management/lib/bpmnNotationSpec'
import { BpmnEventMarkerIcon, BpmnGatewayMarkerIcon, BpmnTaskMarkerIcon } from '@/modules/project-management/lib/bpmnNotationMarks'
import type {
  ArchimateBoundaryNodeData,
  ArchimateElementNodeData,
  ArchimateImageNodeData,
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
  keepAspectRatio = false,
}: {
  selected: boolean
  minWidth: number
  minHeight: number
  keepAspectRatio?: boolean
}) {
  return (
    <NodeResizer
      isVisible={selected}
      minWidth={minWidth}
      minHeight={minHeight}
      keepAspectRatio={keepAspectRatio}
      lineStyle={RESIZER_LINE_STYLE}
      handleStyle={RESIZER_HANDLE_STYLE}
    />
  )
}

const HANDLE_SIZE_PX = 8
const HANDLE_HALF_PX = HANDLE_SIZE_PX / 2

function handlePlacement(side: 'top' | 'right' | 'bottom' | 'left', percent: number): CSSProperties {
  const center = `calc(${percent}% - ${HANDLE_HALF_PX}px)`
  const box: CSSProperties = {
    width: HANDLE_SIZE_PX,
    height: HANDLE_SIZE_PX,
    transform: 'none',
    margin: 0,
  }
  if (side === 'top') return { ...box, top: -HANDLE_HALF_PX, bottom: 'auto', left: center, right: 'auto' }
  if (side === 'bottom') return { ...box, top: `calc(100% - ${HANDLE_HALF_PX}px)`, bottom: 'auto', left: center, right: 'auto' }
  if (side === 'left') return { ...box, left: -HANDLE_HALF_PX, right: 'auto', top: center, bottom: 'auto' }
  return { ...box, left: `calc(100% - ${HANDLE_HALF_PX}px)`, right: 'auto', top: center, bottom: 'auto' }
}

function ConnectionHandles({ nodeId, selected, layoutKey }: { nodeId: string; selected: boolean; layoutKey?: string }) {
  const updateNodeInternals = useUpdateNodeInternals()
  const measuredKey = useStore((state) => {
    const node = state.nodeInternals.get(nodeId)
    return `${Number(node?.width ?? 0)}x${Number(node?.height ?? 0)}`
  })
  const [layoutWidth, layoutHeight] = (layoutKey ?? '0x0').split('x').map((value) => Number(value) || 0)
  const [measuredWidth, measuredHeight] = measuredKey.split('x').map((value) => Number(value) || 0)
  const width = measuredWidth || layoutWidth
  const height = measuredHeight || layoutHeight
  const sizeKey = `${Math.round(width)}x${Math.round(height)}`
  const sourceClass = [
    '!m-0 !box-border !block !min-h-0 !min-w-0 !rounded-full !border !border-white !bg-sky-500 !p-0 !leading-none',
    '!pointer-events-auto !z-30',
    '!opacity-0 !transition-opacity !duration-150',
    'group-hover:!opacity-100',
    selected ? '!opacity-100' : '',
  ].join(' ')
  const targetClass = '!m-0 !box-border !block !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent !p-0 !leading-none !pointer-events-none !opacity-0'

  useEffect(() => {
    updateNodeInternals(nodeId)
    const frame = window.requestAnimationFrame(() => updateNodeInternals(nodeId))
    return () => window.cancelAnimationFrame(frame)
  }, [nodeId, sizeKey, updateNodeInternals])

  const sides: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; position: Position }> = [
    { side: 'top', position: Position.Top },
    { side: 'right', position: Position.Right },
    { side: 'bottom', position: Position.Bottom },
    { side: 'left', position: Position.Left },
  ]

  return (
    <>
      {sides.flatMap(({ side, position }) => {
        const length = side === 'top' || side === 'bottom' ? width : height
        return connectionHandlePercentsForLength(length).flatMap((percent) => {
          const idSuffix = percent === 50 ? side : `${side}-${percent}`
          const offsetStyle = handlePlacement(side, percent)
          return [
            <Handle
              key={`target-${idSuffix}`}
              id={`target-${idSuffix}`}
              type="target"
              position={position}
              className={targetClass}
              style={offsetStyle}
            />,
            <Handle
              key={`source-${idSuffix}`}
              id={`source-${idSuffix}`}
              type="source"
              position={position}
              isConnectable
              isConnectableStart
              isConnectableEnd
              className={sourceClass}
              style={offsetStyle}
            />,
          ]
        })
      })}
    </>
  )
}

export function ArchimateElementNode({ id, data, selected, width, height }: NodeProps<ArchimateElementNodeData>) {
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
      <ConnectionHandles nodeId={id} selected={selected} layoutKey={`${width ?? 0}x${height ?? 0}`} />

      <div className="relative h-full w-full overflow-hidden border" style={boxStyle}>
        {notationImageUrl ? (
          <img
            src={notationImageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute right-2 top-2 z-[1] h-8 w-8 object-contain"
          />
        ) : null}
        <div className="flex min-h-[78px] h-full w-full min-w-0 flex-col items-center justify-center px-4 py-4 pr-11 text-center">
          <p
            className="min-h-0 min-w-0 w-full max-h-full overflow-visible whitespace-pre-wrap break-words text-[13px] font-semibold leading-tight [line-clamp:unset] [-webkit-line-clamp:unset]"
            style={buildIntegrationNodeTextStyle({ ...data.textStyle, wordWrap: data.textStyle?.wordWrap !== false })}
          >
            {data.title}
          </p>
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

export function ArchimateBoundaryNode({ id, data, selected, width, height }: NodeProps<ArchimateBoundaryNodeData>) {
  const boxStyle = buildIntegrationNodeBoxStyle({
    ...data.visual,
    lineStyle: data.visual?.lineStyle ?? 'dashed',
    fillEnabled: data.visual?.fillEnabled ?? false,
    fillColor: data.visual?.fillColor ?? 'rgba(255,255,255,0.15)',
    lineColor: data.visual?.lineColor ?? 'rgba(100,116,139,0.8)',
    rounded: data.visual?.rounded ?? true,
  })
  return (
    <div className="group relative h-full w-full">
      <SelectionResizer selected={selected} minWidth={180} minHeight={120} />
      <ConnectionHandles nodeId={id} selected={selected} layoutKey={`${width ?? 0}x${height ?? 0}`} />
      <div className="h-full w-full border-2 px-4 py-3" style={boxStyle}>
        <p className="boundary-chrome pointer-events-auto text-xs font-semibold text-slate-600">{data.title}</p>
      </div>
    </div>
  )
}

export function ArchimateNoteNode({ id, data, selected, width, height }: NodeProps<ArchimateNoteNodeData>) {
  const boxStyle = buildIntegrationNodeBoxStyle({
    ...data.visual,
    fillEnabled: data.visual?.fillEnabled ?? true,
    fillColor: data.visual?.fillColor ?? 'rgba(255,255,255,0.88)',
    lineColor: data.visual?.lineColor ?? '#e2e8f0',
    shadow: data.visual?.shadow ?? false,
    rounded: data.visual?.rounded ?? true,
  })
  return (
    <div className="group relative h-full w-full">
      <SelectionResizer selected={selected} minWidth={160} minHeight={60} />
      <ConnectionHandles nodeId={id} selected={selected} layoutKey={`${width ?? 0}x${height ?? 0}`} />
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

export function ArchimateImageNode({ data, selected }: NodeProps<ArchimateImageNodeData>) {
  return (
    <div className="group relative h-full w-full rounded-md bg-white shadow-sm">
      <SelectionResizer selected={selected} minWidth={96} minHeight={72} keepAspectRatio />
      <img src={data.src} alt={data.alt} draggable={false} className="pointer-events-none h-full w-full rounded-md border border-slate-200 object-contain" />
    </div>
  )
}

const C4_INTERNAL_FILL = '#438DD5'
const C4_INTERNAL_LINE = '#3C7FC0'
const C4_EXTERNAL_FILL = '#999999'
const C4_EXTERNAL_LINE = '#8A8A8A'

export function C4ElementNode({ id, data, selected, width, height }: NodeProps<ArchimateElementNodeData>) {
  const { setNodes } = useReactFlow()
  const [editingField, setEditingField] = useState<'title' | 'description' | null>(null)
  const [draft, setDraft] = useState('')
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const external = /external/i.test(data.stereotype)
  const fill = data.visual?.fillColor || (external ? C4_EXTERNAL_FILL : C4_INTERNAL_FILL)
  const line = data.visual?.lineColor || (external ? C4_EXTERNAL_LINE : C4_INTERNAL_LINE)
  const isPerson = data.stereotype.toLowerCase().includes('person')
  const isDatabase = data.notationId === 'ContainerDb' || data.notationId === 'SystemDb'
  const layoutKey = `${width ?? 0}x${height ?? 0}`

  useEffect(() => {
    if (!editingField) return
    editorRef.current?.focus()
    editorRef.current?.select()
  }, [editingField])

  const startEditing = (field: 'title' | 'description') => {
    setDraft(field === 'title' ? data.title : data.description.join('\n'))
    setEditingField(field)
  }

  const finishEditing = (commit: boolean) => {
    const field = editingField
    setEditingField(null)
    if (!commit || !field) return

    const value = field === 'title'
      ? draft.trim()
      : draft.split('\n').map((lineText) => lineText.trim()).filter(Boolean)
    if ((field === 'title' && !value) || (field === 'description' && value.length === 0)) return

    setNodes((nodes) => nodes.map((node) => {
      if (node.id !== id || node.data.kind !== 'element') return node
      return {
        ...node,
        data: {
          ...node.data,
          [field]: value,
        },
      }
    }))
  }

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      finishEditing(false)
      return
    }
    if (event.key === 'Enter' && (editingField === 'title' || !event.shiftKey)) {
      event.preventDefault()
      finishEditing(true)
    }
  }

  return (
    <div className="group relative h-full w-full overflow-visible">
      <SelectionResizer selected={selected} minWidth={140} minHeight={72} />
      <ConnectionHandles nodeId={id} selected={selected} layoutKey={layoutKey} />
      {data.applicationCatalogName ? (
        <span
          title={`Application Catalog: ${data.applicationCatalogName}`}
          className="pointer-events-none absolute left-2 top-2 z-10 inline-flex h-5 items-center gap-1 rounded border border-white/60 bg-white/95 px-1.5 text-[9px] font-semibold leading-none text-slate-700 shadow-sm"
        >
          <Library className="h-2.5 w-2.5" aria-hidden />
          Catalog
        </span>
      ) : null}
      {data.diagramLink ? (
        <span
          title="Linked diagram"
          className="pointer-events-none absolute right-2 top-2 z-10 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-white/90 text-slate-700 shadow-sm"
        >
          <Link2 className="h-2.5 w-2.5" aria-hidden />
        </span>
      ) : null}
      {isPerson ? (
        <svg viewBox="0 0 48 28" className="pointer-events-none absolute left-1/2 top-0 h-7 w-12 -translate-x-1/2 -translate-y-1/2 text-white" aria-hidden>
          <circle cx="24" cy="8" r="6" fill={fill} stroke={line} strokeWidth="1.5" />
          <path d="M10 28c2-10 10-14 14-14s12 4 14 14" fill={fill} stroke={line} strokeWidth="1.5" />
        </svg>
      ) : null}
      <div
        className="flex h-full w-full flex-col items-center justify-center px-3 py-2 text-center text-white"
        style={{
          background: fill,
          border: `1.5px solid ${line}`,
          borderRadius: isDatabase ? '50% / 18%' : 8,
          boxShadow: '0 1px 4px rgba(15,23,42,0.18)',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <p className="text-[10px] italic leading-none opacity-90">{`<<${data.stereotype}>>`}</p>
        {editingField === 'title' ? (
          <input
            ref={editorRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishEditing(true)}
            onKeyDown={handleEditorKeyDown}
            className="nodrag nowheel mt-1 w-full rounded border border-white/70 bg-white/15 px-1 text-center text-[13px] font-semibold leading-tight text-white outline-none"
            aria-label="Edit title"
          />
        ) : (
          <p
            className="mt-1 cursor-text text-[13px] font-semibold leading-tight"
            title={data.diagramLink ? 'Double-click to open linked diagram' : 'Double-click to edit title'}
            onDoubleClick={(event) => {
              if (data.diagramLink) return
              event.stopPropagation()
              startEditing('title')
            }}
          >
            {data.title}
          </p>
        )}
        {editingField === 'description' ? (
          <textarea
            ref={editorRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishEditing(true)}
            onKeyDown={handleEditorKeyDown}
            rows={Math.max(2, data.description.length)}
            className="nodrag nowheel mt-1 w-full resize-none rounded border border-white/70 bg-white/15 px-1 text-center text-[10px] leading-4 text-white outline-none"
            aria-label="Edit description"
          />
        ) : (
          <div
            className="mt-0.5 cursor-text text-[10px] leading-4 opacity-95"
            title={data.diagramLink ? 'Double-click to open linked diagram' : 'Double-click to edit description'}
            onDoubleClick={(event) => {
              if (data.diagramLink) return
              event.stopPropagation()
              startEditing('description')
            }}
          >
            {data.description.map((lineText, index) => (
              <p key={`${lineText}-${index}`}>{lineText}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ExternalNodeLabel({
  nodeId,
  selected,
  title,
  textStyle,
}: {
  nodeId: string
  selected: boolean
  title: string
  textStyle: ArchimateElementNodeData['textStyle']
}) {
  const { setNodes } = useReactFlow()
  const zoom = useStore((state) => state.transform[2]) || 1
  const resolved = resolveNodeTextStyle(textStyle)
  const labelBoxRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    kind: 'move' | 'e' | 's' | 'se'
    startX: number
    startY: number
    originX: number
    originY: number
    originW: number
    originH: number
  } | null>(null)
  const [live, setLive] = useState<{ offsetX: number; offsetY: number; boxWidth: number; boxHeight: number } | null>(null)
  const offsetX = live?.offsetX ?? resolved.offsetX
  const offsetY = live?.offsetY ?? resolved.offsetY
  const boxWidth = live?.boxWidth ?? resolved.boxWidth
  const boxHeight = live?.boxHeight ?? resolved.boxHeight
  const wrapLabel = resolved.wordWrap || boxWidth > 0 || boxHeight > 0

  const commit = (next: { offsetX: number; offsetY: number; boxWidth: number; boxHeight: number }) => {
    setNodes((nodes) => nodes.map((node) => {
      if (node.id !== nodeId || node.data.kind !== 'element') return node
      return {
        ...node,
        data: {
          ...node.data,
          textStyle: {
            ...node.data.textStyle,
            offsetX: next.offsetX,
            offsetY: next.offsetY,
            boxWidth: next.boxWidth,
            boxHeight: next.boxHeight,
            wordWrap: next.boxWidth > 0 || next.boxHeight > 0 || Boolean(node.data.textStyle?.wordWrap),
          },
        },
      }
    }))
    setLive(null)
  }

  const measuredBox = () => {
    const rect = labelBoxRef.current?.getBoundingClientRect()
    return {
      width: boxWidth > 0 ? boxWidth : Math.max(48, (rect?.width ?? 80) / zoom),
      height: boxHeight > 0 ? boxHeight : Math.max(18, (rect?.height ?? 20) / zoom),
    }
  }

  const begin = (kind: 'move' | 'e' | 's' | 'se') => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
    const measured = measuredBox()
    dragRef.current = {
      pointerId: event.pointerId,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetX,
      originY: offsetY,
      originW: measured.width,
      originH: measured.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: node.id === nodeId })))
  }

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = (event.clientX - drag.startX) / zoom
    const dy = (event.clientY - drag.startY) / zoom
    if (drag.kind === 'move') {
      setLive({ offsetX: drag.originX + dx, offsetY: drag.originY + dy, boxWidth, boxHeight })
      return
    }
    setLive({
      offsetX: drag.originX,
      offsetY: drag.originY,
      boxWidth: drag.kind === 's' ? drag.originW : Math.max(48, drag.originW + dx),
      boxHeight: drag.kind === 'e' ? boxHeight : Math.max(16, drag.originH + dy),
    })
  }

  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    const dx = (event.clientX - drag.startX) / zoom
    const dy = (event.clientY - drag.startY) / zoom
    if (drag.kind === 'move') {
      commit({ offsetX: drag.originX + dx, offsetY: drag.originY + dy, boxWidth, boxHeight })
      return
    }
    commit({
      offsetX: drag.originX,
      offsetY: drag.originY,
      boxWidth: drag.kind === 's' ? drag.originW : Math.max(48, drag.originW + dx),
      boxHeight: drag.kind === 'e' ? boxHeight : Math.max(16, drag.originH + dy),
    })
  }

  if (!title) return null

  return (
    <div
      className="nodrag nopan absolute left-1/2 z-20"
      style={{
        top: '100%',
        transform: `translate(-50%, 6px) translate(${offsetX}px, ${offsetY}px) rotate(${resolved.angle}deg)`,
        pointerEvents: 'all',
      }}
    >
      <div
        ref={labelBoxRef}
        role="button"
        tabIndex={0}
        style={{
          boxSizing: 'border-box',
          width: boxWidth > 0 ? boxWidth : 'max-content',
          minWidth: 48,
          height: boxHeight > 0 ? boxHeight : 'auto',
          minHeight: 16,
          padding: `${2 + resolved.spacingTop}px ${4 + resolved.spacingRight}px ${2 + resolved.spacingBottom}px ${4 + resolved.spacingLeft}px`,
          borderRadius: 4,
          border: selected ? '1px solid #0284c7' : '1px solid transparent',
          background: selected ? 'rgba(224, 242, 254, 0.92)' : 'transparent',
          color: resolved.fontColorEnabled ? resolved.fontColor : '#334155',
          fontFamily: resolved.fontFamily,
          fontSize: Math.max(10, resolved.fontSize - 1),
          fontWeight: resolved.bold ? 600 : 400,
          fontStyle: resolved.italic ? 'italic' : 'normal',
          textDecoration: resolved.underline ? 'underline' : 'none',
          textAlign: resolved.align,
          letterSpacing: resolved.spacingGlobal ? `${resolved.spacingGlobal}px` : undefined,
          opacity: Math.max(0, Math.min(100, resolved.opacity)) / 100,
          whiteSpace: wrapLabel ? 'pre-wrap' : 'nowrap',
          overflowWrap: wrapLabel ? 'break-word' : 'normal',
          wordBreak: wrapLabel ? 'break-word' : 'normal',
          overflow: wrapLabel ? 'visible' : 'hidden',
          textOverflow: wrapLabel ? 'clip' : 'ellipsis',
          cursor: 'move',
          lineHeight: 1.25,
        }}
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {title}
      </div>
      {selected ? (
        <>
          <div
            role="separator"
            aria-label="Ubah lebar label"
            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-full hover:bg-sky-400/50"
            onPointerDown={begin('e')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <div
            role="separator"
            aria-label="Ubah tinggi label"
            className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize rounded-full hover:bg-sky-400/50"
            onPointerDown={begin('s')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <div
            role="separator"
            aria-label="Ubah ukuran label"
            className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
            onPointerDown={begin('se')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        </>
      ) : null}
    </div>
  )
}

export function BpmnElementNode({ id, data, selected, width, height }: NodeProps<ArchimateElementNodeData>) {
  const type = data.notationId
  const kind = classifyBpmnType(type)
  const layoutKey = `${width ?? 0}x${height ?? 0}`
  const stroke = bpmnResolvedLineColor(type, data.visual?.lineColor)
  const fill = data.visual?.fillColor || '#ffffff'
  const lockSquare = isBpmnSquareShape(type)
  const isEvent = kind.family === 'event'
  const isGateway = kind.family === 'gateway'
  const isAnnotation = kind.family === 'annotation'
  const minSize = isEvent ? 36 : isGateway ? 56 : 80

  return (
    <div className="group relative h-full w-full overflow-visible">
      <SelectionResizer
        selected={selected}
        minWidth={lockSquare ? minSize : isAnnotation ? 80 : kind.family === 'pool' || kind.family === 'lane' ? 160 : 120}
        minHeight={lockSquare ? minSize : isAnnotation ? 40 : kind.family === 'pool' || kind.family === 'lane' ? 64 : 56}
        keepAspectRatio={lockSquare}
      />
      <ConnectionHandles nodeId={id} selected={selected} layoutKey={layoutKey} />
      {isEvent ? (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="relative flex aspect-square h-[88%] w-[88%] items-center justify-center rounded-full bg-white"
            style={{
              border: kind.eventPhase === 'end' ? `4px solid ${stroke}` : `2px solid ${stroke}`,
              boxShadow: kind.eventPhase === 'intermediate' ? `inset 0 0 0 2px ${stroke}` : undefined,
            }}
          >
            <span className="h-[46%] w-[46%]">
              {kind.eventMarker === 'terminate' ? (
                <span className="block h-full w-full rounded-full bg-slate-900" />
              ) : (
                <BpmnEventMarkerIcon marker={kind.eventMarker ?? 'none'} color={stroke} />
              )}
            </span>
          </div>
          <ExternalNodeLabel nodeId={id} selected={selected} title={data.title} textStyle={data.textStyle} />
        </div>
      ) : isGateway ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="relative aspect-square h-[78%] w-[78%] rotate-45 border-2 bg-white" style={{ borderColor: stroke }}>
            <svg viewBox="0 0 24 24" className="absolute inset-[18%] -rotate-45" aria-hidden>
              <BpmnGatewayMarkerIcon kind={kind.gateway ?? 'exclusive'} color={stroke} />
            </svg>
          </div>
          <ExternalNodeLabel nodeId={id} selected={selected} title={data.title} textStyle={data.textStyle} />
        </div>
      ) : isAnnotation ? (
        <div className="relative h-full w-full bg-white/80 py-1 pl-2 pr-1">
          <span className="absolute bottom-0 left-0 top-0 w-[10px] border-y-2 border-l-2 border-slate-900" />
          <p
            className="min-h-0 min-w-0 w-full max-h-full overflow-visible whitespace-pre-wrap break-words pl-2 text-[12px] leading-4 text-slate-800 [line-clamp:unset] [-webkit-line-clamp:unset]"
            style={buildIntegrationNodeTextStyle({ ...data.textStyle, wordWrap: true })}
          >
            {data.title}
          </p>
        </div>
      ) : kind.family === 'pool' || kind.family === 'lane' ? (
        <div className="flex h-full w-full overflow-hidden border-2 bg-white/70" style={{ borderColor: stroke }}>
          <div className="flex w-7 shrink-0 items-center justify-center border-r-2 bg-slate-50" style={{ borderColor: stroke }}>
            <p className="rotate-180 truncate text-[11px] font-semibold tracking-wide text-slate-700" style={{ writingMode: 'vertical-rl' }}>
              {data.title}
            </p>
          </div>
        </div>
      ) : kind.family === 'group' ? (
        <div className="h-full w-full rounded-md border-2 border-dashed border-slate-500 bg-transparent px-2 py-1">
          <p
            className="min-w-0 w-full overflow-visible whitespace-pre-wrap break-words text-[11px] font-medium text-slate-600"
            style={buildIntegrationNodeTextStyle({ ...data.textStyle, wordWrap: true })}
          >
            {data.title}
          </p>
        </div>
      ) : (
        <div
          className="relative flex h-full min-h-0 w-full min-w-0 flex-col justify-center overflow-visible rounded-[10px] border-2 px-3 py-2 text-center"
          style={{
            borderColor: stroke,
            background: fill,
            borderStyle: kind.eventSubprocess ? 'dashed' : 'solid',
            borderWidth: kind.taskMarker === 'call' ? 3 : 2,
          }}
        >
          {kind.taskMarker && kind.taskMarker !== 'none' ? (
            <span className="absolute left-2 top-2 h-4 w-4">
              <BpmnTaskMarkerIcon marker={kind.taskMarker} color={stroke} />
            </span>
          ) : null}
          {kind.family === 'subprocess' || kind.family === 'choreography' ? (
            <span className="absolute bottom-1.5 left-1/2 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center border border-slate-800 text-[10px] leading-none">+</span>
          ) : null}
          <p
            className="min-h-0 min-w-0 w-full max-h-full overflow-visible whitespace-pre-wrap break-words text-[12px] font-medium leading-4 text-slate-900 [line-clamp:unset] [-webkit-line-clamp:unset]"
            style={buildIntegrationNodeTextStyle({ ...data.textStyle, wordWrap: true })}
          >
            {data.title}
          </p>
        </div>
      )}
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
  archimateImage: ArchimateImageNode,
  archimateLegend: ArchimateLegendNode,
  c4Element: C4ElementNode,
  bpmnElement: BpmnElementNode,
}
