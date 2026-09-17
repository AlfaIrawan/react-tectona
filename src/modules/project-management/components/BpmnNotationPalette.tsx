import type { DragEvent } from 'react'
import { cn } from '@/lib/utils'
import { BPMN_PALETTE_GROUPS, type BpmnPaletteItem } from '@/modules/project-management/lib/bpmnNotationPalette'
import { bpmnDefaultLineColor, classifyBpmnType } from '@/modules/project-management/lib/bpmnNotationSpec'
import { BpmnEventMarkerIcon, BpmnGatewayMarkerIcon, BpmnTaskMarkerIcon } from '@/modules/project-management/lib/bpmnNotationMarks'

function BpmnPalettePreview({ item }: { item: BpmnPaletteItem }) {
  const kind = classifyBpmnType(item.bpmnType)
  const color = bpmnDefaultLineColor(item.bpmnType)
  if (kind.family === 'event') {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <span
          className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white"
          style={{
            border: kind.eventPhase === 'end' ? `3px solid ${color}` : `1.6px solid ${color}`,
            boxShadow: kind.eventPhase === 'intermediate' ? `inset 0 0 0 1.5px ${color}` : undefined,
          }}
        >
          <span className="h-3.5 w-3.5">
            <BpmnEventMarkerIcon marker={kind.eventMarker ?? 'none'} color={color} />
          </span>
        </span>
      </div>
    )
  }
  if (kind.family === 'gateway') {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <span className="relative h-4 w-4 rotate-45 border-[1.5px] bg-white" style={{ borderColor: color }}>
          <svg viewBox="0 0 24 24" className="absolute inset-[12%] -rotate-45" aria-hidden>
            <BpmnGatewayMarkerIcon kind={kind.gateway ?? 'exclusive'} color={color} />
          </svg>
        </span>
      </div>
    )
  }
  if (kind.family === 'annotation') {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <span className="h-5 w-5 border-y-[1.5px] border-l-[1.5px] border-slate-700 bg-white" />
      </div>
    )
  }
  if (kind.family === 'pool' || kind.family === 'lane') {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <span className={cn('border border-sky-500 bg-sky-50', kind.family === 'pool' ? 'h-4 w-6' : 'h-3 w-6')} />
      </div>
    )
  }
  if (kind.family === 'group') {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <span className="h-5 w-6 rounded-sm border border-dashed border-slate-500" />
      </div>
    )
  }
  if (item.kind === 'flow') {
    const dashed = item.bpmnType === 'messageFlow'
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 28 16" className="h-4 w-7" aria-hidden>
          {item.bpmnType === 'defaultSequenceFlow' ? <path d="M3 12 7 4" stroke="#334155" strokeWidth="1.4" /> : null}
          {item.bpmnType === 'expressionSequenceFlow' ? (
            <text x="1" y="7" fontSize="7" fill="#334155">/</text>
          ) : null}
          {item.bpmnType === 'messageFlow' ? <circle cx="3" cy="8" r="1.6" fill="none" stroke="#334155" strokeWidth="1.2" /> : null}
          <path
            d={item.bpmnType === 'messageFlow' ? 'M6 8h16' : 'M2 8h18'}
            fill="none"
            stroke="#334155"
            strokeWidth="1.4"
            strokeDasharray={dashed ? '3 2' : undefined}
          />
          <path d="M20 5.5 24 8l-4 2.5" fill="none" stroke="#334155" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center">
      <span className="relative h-5 w-6 rounded-[3px] border border-slate-700 bg-white">
        <span className="absolute left-0.5 top-0.5 h-2.5 w-2.5">
          <BpmnTaskMarkerIcon marker={kind.taskMarker ?? 'none'} />
        </span>
        {kind.family === 'subprocess' ? (
          <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 border border-slate-700 text-[6px] leading-none">+</span>
        ) : null}
      </span>
    </div>
  )
}

export function BpmnNotationPalette({
  onDragStart,
  selectedFlowType,
  onSelectFlow,
}: {
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: BpmnPaletteItem) => void
  selectedFlowType?: string
  onSelectFlow?: (item: BpmnPaletteItem) => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">BPMN notation</p>
      <p className="mb-1.5 text-[9px] leading-3 text-slate-500">
        Seret shape ke canvas. Pilih jenis flow, lalu sambungkan handle antar node.
      </p>
      <div className="space-y-2">
        {BPMN_PALETTE_GROUPS.map((group) => (
          <section key={group.id}>
            <p className="mb-0.5 px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
            <div className="flex flex-col">
              {group.items.map((item) => {
                const isFlow = item.kind === 'flow'
                const selected = isFlow && selectedFlowType === item.bpmnType
                return (
                  <button
                    key={item.id}
                    type="button"
                    draggable={!isFlow}
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={isFlow ? selected : undefined}
                    onClick={() => {
                      if (isFlow) onSelectFlow?.(item)
                    }}
                    onDragStart={(event) => {
                      if (isFlow) {
                        event.preventDefault()
                        return
                      }
                      onDragStart(event, item)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-1 py-0.5 text-left',
                      isFlow ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                      selected ? 'bg-sky-100' : 'hover:bg-sky-50',
                    )}
                  >
                    <BpmnPalettePreview item={item} />
                    <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-slate-700">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
