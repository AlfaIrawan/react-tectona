import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  GripVertical,
  Italic,
  Underline,
} from 'lucide-react'
import type { Edge } from 'reactflow'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  INTEGRATION_FONT_FAMILIES,
  INTEGRATION_STYLE_COLOR_PRESETS,
} from '@/modules/project-management/lib/integrationNodeAppearance'
import type {
  IntegrationEdgeArrangeOptions,
  IntegrationEdgeArrow,
  IntegrationEdgeData,
  IntegrationEdgeJumpStyle,
  IntegrationEdgeLinePattern,
  IntegrationEdgeTextStyle,
  IntegrationEdgeVisualStyle,
  IntegrationEdgeWaypoints,
} from '@/modules/project-management/lib/integrationArchitectureTypes'
import {
  defaultIntegrationEdgeArrange,
  defaultIntegrationEdgeTextStyle,
  defaultIntegrationEdgeVisual,
  edgeDashArray,
  readEdgeData,
  resolveEdgeArrange,
  resolveEdgeTextStyle,
  resolveEdgeVisual,
} from '@/modules/project-management/lib/integrationEdgeAppearance'

type PropertiesTab = 'style' | 'text' | 'arrange'

type DragHandleProps = {
  isDragging: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
}

const PANEL_TAB_CLASS = (active: boolean) =>
  cn(
    'flex-1 border-b px-2 py-2 text-[11px] font-semibold transition-colors',
    active
      ? 'border-slate-900 bg-white text-slate-900'
      : 'border-transparent bg-slate-100/90 text-slate-600 hover:text-slate-800',
  )

const PANEL_SECTION_CLASS = 'space-y-2 border-b border-slate-200/80 pb-3'
const PANEL_LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500'
const PANEL_MINI_BUTTON_CLASS =
  'inline-flex h-7 min-w-0 flex-1 items-center justify-center rounded border border-slate-300 bg-gradient-to-b from-white to-slate-100 px-2 text-[10px] font-medium text-slate-700 shadow-sm hover:from-slate-50 hover:to-slate-200'
const PANEL_TOGGLE_CLASS = (active: boolean) =>
  cn(
    'inline-flex h-7 w-7 items-center justify-center rounded border text-[11px] font-semibold',
    active
      ? 'border-sky-300 bg-sky-100 text-sky-900'
      : 'border-slate-300 bg-gradient-to-b from-white to-slate-100 text-slate-700 hover:from-slate-50 hover:to-slate-200',
  )

let edgeStyleClipboard: {
  visual: IntegrationEdgeVisualStyle
  textStyle: IntegrationEdgeTextStyle
  arrange: IntegrationEdgeArrangeOptions
} | null = null

export function splitEdgeLabel(label?: string): { text: string; technology: string } {
  const raw = String(label ?? '')
  const match = /\s*\[([^\]]+)\]\s*$/.exec(raw)
  return {
    text: match ? raw.slice(0, match.index).trim() : raw,
    technology: match?.[1] ?? '',
  }
}

export function joinEdgeLabel(text: string, technology: string): string {
  const trimmed = text.trim()
  const tech = technology.trim()
  if (!trimmed && !tech) return ''
  return tech ? `${trimmed || 'uses'} [${tech}]` : trimmed
}

function NumberStepper({
  label,
  value,
  suffix,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  suffix?: string
  onChange: (value: number) => void
  step?: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number.parseFloat(event.target.value) || 0)}
          className="h-7 px-2 text-[11px]"
        />
        <div className="flex flex-col">
          <button
            type="button"
            className="inline-flex h-3.5 w-5 items-center justify-center rounded-t border border-slate-300 bg-slate-50 text-[9px] leading-none"
            onClick={() => onChange(value + step)}
            aria-label={`Increase ${label}`}
          >
            ▲
          </button>
          <button
            type="button"
            className="inline-flex h-3.5 w-5 items-center justify-center rounded-b border border-t-0 border-slate-300 bg-slate-50 text-[9px] leading-none"
            onClick={() => onChange(value - step)}
            aria-label={`Decrease ${label}`}
          >
            ▼
          </button>
        </div>
        {suffix ? <span className="text-[10px] text-slate-500">{suffix}</span> : null}
      </div>
      {label ? <p className="text-center text-[10px] text-slate-500">{label}</p> : null}
    </div>
  )
}

function CheckboxRow({
  label,
  checked,
  onChange,
  color,
  onColorChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  color?: string
  onColorChange?: (color: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-slate-700">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      {onColorChange ? (
        <input
          type="color"
          value={color ?? '#334155'}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          aria-label={`${label} color`}
        />
      ) : null}
    </div>
  )
}

function PropertyRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[1fr_1.1fr] items-center gap-2 border-b border-sky-100 py-1 text-[11px]">
      <span className="text-sky-900">{label}</span>
      <div className="min-w-0 text-slate-800">{children}</div>
    </div>
  )
}

const ARROW_OPTIONS: Array<{ value: IntegrationEdgeArrow; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'classic', label: 'Classic' },
  { value: 'block', label: 'Block' },
  { value: 'open', label: 'Open' },
  { value: 'oval', label: 'Oval' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'dash', label: 'Dash' },
]

const LINE_PATTERNS: IntegrationEdgeLinePattern[] = ['solid', 'dashed', 'dotted', 'dashdot']

function ToolbarIcon({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(PANEL_TOGGLE_CLASS(active), 'h-7 w-8')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ArrowGlyph({ kind }: { kind: IntegrationEdgeArrow }) {
  if (kind === 'none') {
    return <span className="h-px w-4 bg-slate-700" />
  }
  if (kind === 'oval') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
        <line x1="1" y1="6" x2="10" y2="6" stroke="#334155" strokeWidth="1.5" />
        <circle cx="13" cy="6" r="3" fill="none" stroke="#334155" strokeWidth="1.5" />
      </svg>
    )
  }
  if (kind === 'dash') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
        <line x1="1" y1="6" x2="12" y2="6" stroke="#334155" strokeWidth="1.5" />
        <line x1="14" y1="2" x2="14" y2="10" stroke="#334155" strokeWidth="1.5" />
      </svg>
    )
  }
  if (kind === 'open') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
        <line x1="1" y1="6" x2="11" y2="6" stroke="#334155" strokeWidth="1.5" />
        <polyline points="8,2 16,6 8,10" fill="none" stroke="#334155" strokeWidth="1.5" />
      </svg>
    )
  }
  if (kind === 'diamond') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
        <line x1="1" y1="6" x2="8" y2="6" stroke="#334155" strokeWidth="1.5" />
        <polygon points="8,6 12,3 16,6 12,9" fill="none" stroke="#334155" strokeWidth="1.4" />
      </svg>
    )
  }
  if (kind === 'block') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
        <line x1="1" y1="6" x2="9" y2="6" stroke="#334155" strokeWidth="1.5" />
        <polygon points="9,2 17,6 9,10" fill="#334155" />
      </svg>
    )
  }
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
      <line x1="1" y1="6" x2="10" y2="6" stroke="#334155" strokeWidth="1.5" />
      <polygon points="10,2 17,6 10,10" fill="#334155" />
    </svg>
  )
}

function DashGlyph({ pattern }: { pattern: IntegrationEdgeLinePattern }) {
  const dash =
    pattern === 'dashed' ? '4 2' : pattern === 'dotted' ? '1 2' : pattern === 'dashdot' ? '5 2 1 2' : undefined
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
      <line x1="1" y1="6" x2="17" y2="6" stroke="#334155" strokeWidth="1.6" strokeDasharray={dash} />
    </svg>
  )
}

function swapEdgeHandleRole(handle?: string | null): string | undefined {
  if (!handle) return undefined
  if (handle.startsWith('source-')) return `target-${handle.slice(7)}`
  if (handle.startsWith('target-')) return `source-${handle.slice(7)}`
  return handle
}

export function DiagramEdgePropertiesPanel({
  edge,
  onChange,
  onClearWaypoints,
  dragHandleProps,
}: {
  edge: Edge
  onChange: (patch: Partial<Edge>) => void
  onDelete?: () => void
  onClearWaypoints?: () => void
  dragHandleProps: DragHandleProps
}) {
  const [tab, setTab] = useState<PropertiesTab>('style')
  const [colorPage, setColorPage] = useState(0)
  const visual = resolveEdgeVisual(edge)
  const textStyle = resolveEdgeTextStyle(edge)
  const arrange = resolveEdgeArrange(edge)
  const stored = readEdgeData(edge)
  const parts = splitEdgeLabel(typeof edge.label === 'string' ? edge.label : '')
  const technology = stored.technology ?? parts.technology

  const commit = (patch: {
    label?: string
    visual?: Partial<IntegrationEdgeVisualStyle>
    textStyle?: Partial<IntegrationEdgeTextStyle>
    arrange?: Partial<IntegrationEdgeArrangeOptions>
    technology?: string
    link?: string
  }) => {
    const nextVisual = { ...visual, ...patch.visual }
    const nextText = { ...textStyle, ...patch.textStyle }
    const nextArrange = { ...arrange, ...patch.arrange }
    const nextData: IntegrationEdgeData = {
      ...stored,
      visual: nextVisual,
      textStyle: nextText,
      arrange: nextArrange,
      technology: patch.technology ?? technology,
      link: patch.link ?? stored.link,
    }
    onChange({
      label: patch.label ?? edge.label,
      markerStart: undefined,
      markerEnd: undefined,
      style: {
        ...edge.style,
        stroke: nextVisual.lineColor,
        strokeWidth: nextVisual.lineWidth,
        strokeDasharray: edgeDashArray(nextVisual.lineStyle, nextVisual.lineWidth, nextArrange.fixedDash),
        opacity: nextVisual.opacity / 100,
      },
      data: nextData,
    })
  }

  const colorPages = Math.max(1, Math.ceil(INTEGRATION_STYLE_COLOR_PRESETS.length / 8))
  const visibleColors = INTEGRATION_STYLE_COLOR_PRESETS.slice(colorPage * 8, colorPage * 8 + 8)

  const styleTab = (
    <div className="space-y-3">
      <div className={PANEL_SECTION_CLASS}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-500"
            onClick={() => setColorPage((page) => (page - 1 + colorPages) % colorPages)}
            aria-label="Previous colors"
          >
            ‹
          </button>
          <div className="grid flex-1 grid-cols-4 gap-1">
            {visibleColors.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  'h-7 w-full rounded border border-slate-300',
                  visual.lineColor.toLowerCase() === color.toLowerCase() && 'ring-2 ring-sky-500 ring-offset-1',
                )}
                style={{ backgroundColor: color }}
                onClick={() => commit({ visual: { lineColor: color, lineEnabled: true } })}
                aria-label={`Preset ${color}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-500"
            onClick={() => setColorPage((page) => (page + 1) % colorPages)}
            aria-label="Next colors"
          >
            ›
          </button>
        </div>
        <div className="flex justify-center gap-1">
          {Array.from({ length: colorPages }, (_, index) => (
            <span
              key={index}
              className={cn('h-1.5 w-1.5 rounded-full', index === colorPage ? 'bg-sky-500' : 'bg-slate-300')}
            />
          ))}
        </div>
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <input
              type="checkbox"
              checked={visual.lineEnabled}
              onChange={(event) => commit({ visual: { lineEnabled: event.target.checked } })}
            />
            Line
          </label>
          <Select
            value={visual.waypoints}
            onChange={(event) => commit({ visual: { waypoints: event.target.value as IntegrationEdgeWaypoints } })}
            className="h-7 min-w-0 flex-1 text-[11px]"
          >
            <option value="sharp">Sharp</option>
            <option value="rounded">Rounded</option>
            <option value="curved">Curved</option>
          </Select>
          <input
            type="color"
            value={visual.lineColor}
            onChange={(event) => commit({ visual: { lineColor: event.target.value, lineEnabled: true } })}
            className="h-7 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
            aria-label="Line color"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {ARROW_OPTIONS.slice(0, 4).map((option) => (
            <ToolbarIcon
              key={`end-quick-${option.value}`}
              label={`Line end ${option.label}`}
              active={visual.endArrow === option.value}
              onClick={() => commit({ visual: { endArrow: option.value } })}
            >
              <ArrowGlyph kind={option.value} />
            </ToolbarIcon>
          ))}
          {LINE_PATTERNS.map((pattern) => (
            <ToolbarIcon
              key={pattern}
              label={pattern}
              active={visual.lineStyle === pattern}
              onClick={() => commit({ visual: { lineStyle: pattern } })}
            >
              <DashGlyph pattern={pattern} />
            </ToolbarIcon>
          ))}
          <div className="ml-auto w-[4.5rem]">
            <NumberStepper
              label=""
              suffix="pt"
              step={0.5}
              value={visual.lineWidth}
              onChange={(lineWidth) => commit({ visual: { lineWidth: Math.max(0.5, lineWidth) } })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-slate-700">Line end</span>
            <Select
              value={visual.endArrow}
              onChange={(event) => commit({ visual: { endArrow: event.target.value as IntegrationEdgeArrow } })}
              className="h-7 min-w-0 flex-1 text-[11px]"
            >
              {ARROW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-16">
            <NumberStepper label="Spacing" value={visual.endSpacing} onChange={(endSpacing) => commit({ visual: { endSpacing } })} />
            <NumberStepper label="Size" value={visual.endSize} onChange={(endSize) => commit({ visual: { endSize: Math.max(2, endSize) } })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-slate-700">Line start</span>
            <Select
              value={visual.startArrow}
              onChange={(event) => commit({ visual: { startArrow: event.target.value as IntegrationEdgeArrow } })}
              className="h-7 min-w-0 flex-1 text-[11px]"
            >
              {ARROW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-16">
            <NumberStepper label="Spacing" value={visual.startSpacing} onChange={(startSpacing) => commit({ visual: { startSpacing } })} />
            <NumberStepper label="Size" value={visual.startSize} onChange={(startSize) => commit({ visual: { startSize: Math.max(2, startSize) } })} />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] text-slate-700">Line jumps</p>
            <Select
              value={visual.lineJumps}
              onChange={(event) => commit({ visual: { lineJumps: event.target.value as IntegrationEdgeJumpStyle } })}
              className="h-7 w-full text-[11px]"
            >
              <option value="none">None</option>
              <option value="arc">Arc</option>
              <option value="gap">Gap</option>
              <option value="sharp">Sharp</option>
            </Select>
          </div>
          <div className="w-20">
            <NumberStepper label="" suffix="pt" value={visual.jumpSize} onChange={(jumpSize) => commit({ visual: { jumpSize } })} />
          </div>
        </div>
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <div className="flex items-center justify-between gap-2">
          <span className={PANEL_LABEL_CLASS}>Opacity</span>
          <div className="w-28">
            <NumberStepper label="" suffix="%" value={visual.opacity} onChange={(opacity) => commit({ visual: { opacity: Math.max(0, Math.min(100, opacity)) } })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CheckboxRow label="Shadow" checked={visual.shadow} onChange={(shadow) => commit({ visual: { shadow } })} />
          <CheckboxRow label="Sketch" checked={visual.sketch} onChange={(sketch) => commit({ visual: { sketch } })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(PANEL_MINI_BUTTON_CLASS, 'col-span-2')}
          onClick={() => commit({ visual: defaultIntegrationEdgeVisual(), arrange: defaultIntegrationEdgeArrange() })}
        >
          Edit Style
        </button>
        <button
          type="button"
          className={PANEL_MINI_BUTTON_CLASS}
          onClick={() => {
            edgeStyleClipboard = { visual: { ...visual }, textStyle: { ...textStyle }, arrange: { ...arrange } }
          }}
        >
          Copy Style
        </button>
        <button
          type="button"
          className={PANEL_MINI_BUTTON_CLASS}
          onClick={() => {
            if (!edgeStyleClipboard) return
            commit({
              visual: edgeStyleClipboard.visual,
              textStyle: edgeStyleClipboard.textStyle,
              arrange: edgeStyleClipboard.arrange,
            })
          }}
        >
          Paste Style
        </button>
      </div>

      <div className="overflow-hidden rounded border border-sky-200">
        <div className="grid grid-cols-[1fr_1.1fr] bg-sky-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          <span>Property</span>
          <span>Value</span>
        </div>
        <div className="bg-sky-50/70 px-2">
          <PropertyRow label="ID"><span className="truncate font-mono text-[10px]">{edge.id}</span></PropertyRow>
          <PropertyRow label="Arc Size">
            <NumberStepper label="" value={arrange.arcSize} onChange={(arcSize) => commit({ arrange: { arcSize } })} />
          </PropertyRow>
          <PropertyRow label="Source Constraint">
            <Input className="h-6 px-1 text-[11px]" value={arrange.sourceConstraint} onChange={(event) => commit({ arrange: { sourceConstraint: event.target.value } })} />
          </PropertyRow>
          <PropertyRow label="Target Constraint">
            <Input className="h-6 px-1 text-[11px]" value={arrange.targetConstraint} onChange={(event) => commit({ arrange: { targetConstraint: event.target.value } })} />
          </PropertyRow>
          <PropertyRow label="Fill Opacity">
            <NumberStepper label="" value={arrange.fillOpacity} onChange={(fillOpacity) => commit({ arrange: { fillOpacity } })} />
          </PropertyRow>
          <PropertyRow label="Stroke Opacity">
            <NumberStepper label="" value={arrange.strokeOpacity} onChange={(strokeOpacity) => commit({ arrange: { strokeOpacity } })} />
          </PropertyRow>
          <PropertyRow label="Start Fill">
            <input type="checkbox" checked={visual.startFill} onChange={(event) => commit({ visual: { startFill: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="End Fill">
            <input type="checkbox" checked={visual.endFill} onChange={(event) => commit({ visual: { endFill: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Terminal Spacing">
            <NumberStepper label="" value={arrange.terminalSpacing} onChange={(terminalSpacing) => commit({ arrange: { terminalSpacing } })} />
          </PropertyRow>
          <PropertyRow label="Anchor Direction">
            <input type="checkbox" checked={arrange.anchorDirection} onChange={(event) => commit({ arrange: { anchorDirection: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Snap to Point">
            <input type="checkbox" checked={arrange.snapToPoint} onChange={(event) => commit({ arrange: { snapToPoint: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Fixed Dash">
            <input type="checkbox" checked={arrange.fixedDash} onChange={(event) => commit({ arrange: { fixedDash: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Editable">
            <input type="checkbox" checked={arrange.editable} onChange={(event) => commit({ arrange: { editable: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Edit Dialog">
            <input type="checkbox" checked={arrange.editDialog} onChange={(event) => commit({ arrange: { editDialog: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Background Outline">
            <input type="checkbox" checked={arrange.backgroundOutline} onChange={(event) => commit({ arrange: { backgroundOutline: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Bendable">
            <input type="checkbox" checked={arrange.bendable} onChange={(event) => commit({ arrange: { bendable: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Movable">
            <input type="checkbox" checked={arrange.movable} onChange={(event) => commit({ arrange: { movable: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Cloneable">
            <input type="checkbox" checked={arrange.cloneable} onChange={(event) => commit({ arrange: { cloneable: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Deletable">
            <input type="checkbox" checked={arrange.deletable} onChange={(event) => commit({ arrange: { deletable: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="No Jumps">
            <input type="checkbox" checked={arrange.noJumps} onChange={(event) => commit({ arrange: { noJumps: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Flow Animation">
            <input type="checkbox" checked={arrange.flowAnimation} onChange={(event) => commit({ arrange: { flowAnimation: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Ignore Edge">
            <input type="checkbox" checked={arrange.ignoreEdge} onChange={(event) => commit({ arrange: { ignoreEdge: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Loop Routing">
            <input type="checkbox" checked={arrange.loopRouting} onChange={(event) => commit({ arrange: { loopRouting: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Orthogonal">
            <input type="checkbox" checked={arrange.orthogonal} onChange={(event) => commit({ arrange: { orthogonal: event.target.checked } })} />
          </PropertyRow>
          <PropertyRow label="Comic">
            <input type="checkbox" checked={arrange.comic} onChange={(event) => commit({ arrange: { comic: event.target.checked } })} />
          </PropertyRow>
        </div>
      </div>
    </div>
  )

  const textTab = (
    <div className="space-y-3">
      <div className={PANEL_SECTION_CLASS}>
        <div className="space-y-1.5">
          <label className={PANEL_LABEL_CLASS}>Teks garis</label>
          <Input
            value={parts.text}
            onChange={(event) => commit({ label: joinEdgeLabel(event.target.value, technology) })}
            placeholder="Mis. Mengirim pertanyaan"
          />
        </div>
        <div className="space-y-1.5">
          <label className={PANEL_LABEL_CLASS}>Teknologi / protokol</label>
          <Input
            value={technology}
            onChange={(event) => commit({
              technology: event.target.value,
              label: joinEdgeLabel(parts.text, event.target.value),
            })}
            placeholder="Mis. HTTPS/API"
          />
        </div>
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <p className={PANEL_LABEL_CLASS}>Font</p>
        <Select
          value={textStyle.fontFamily}
          onChange={(event) => commit({ textStyle: { fontFamily: event.target.value } })}
          className="h-8 w-full text-[11px]"
        >
          {INTEGRATION_FONT_FAMILIES.map((font) => (
            <option key={font} value={font}>{font}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1">
          <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.bold)} onClick={() => commit({ textStyle: { bold: !textStyle.bold } })} aria-label="Bold">
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.italic)} onClick={() => commit({ textStyle: { italic: !textStyle.italic } })} aria-label="Italic">
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.underline)} onClick={() => commit({ textStyle: { underline: !textStyle.underline } })} aria-label="Underline">
            <Underline className="h-3.5 w-3.5" />
          </button>
          <div className="ml-auto w-24">
            <NumberStepper label="" suffix="pt" value={textStyle.fontSize} onChange={(fontSize) => commit({ textStyle: { fontSize } })} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.align === 'left')} onClick={() => commit({ textStyle: { align: 'left' } })} aria-label="Align left">
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.align === 'center')} onClick={() => commit({ textStyle: { align: 'center' } })} aria-label="Align center">
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.align === 'right')} onClick={() => commit({ textStyle: { align: 'right' } })} aria-label="Align right">
            <AlignRight className="h-3.5 w-3.5" />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.verticalAlign === 'top')} onClick={() => commit({ textStyle: { verticalAlign: 'top' } })} aria-label="Align top">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.verticalAlign === 'middle')} onClick={() => commit({ textStyle: { verticalAlign: 'middle' } })} aria-label="Align middle">
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={PANEL_TOGGLE_CLASS(textStyle.verticalAlign === 'bottom')} onClick={() => commit({ textStyle: { verticalAlign: 'bottom' } })} aria-label="Align bottom">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className={PANEL_LABEL_CLASS}>Position</p>
            <Select
              value={textStyle.position}
              onChange={(event) => commit({ textStyle: { position: event.target.value as IntegrationEdgeTextStyle['position'] } })}
              className="h-7 text-[11px]"
            >
              <option value="center">Center</option>
              <option value="source">Source</option>
              <option value="target">Target</option>
            </Select>
          </div>
          <div className="space-y-1">
            <p className={PANEL_LABEL_CLASS}>Writing Direction</p>
            <Select
              value={textStyle.writingDirection}
              onChange={(event) => commit({ textStyle: { writingDirection: event.target.value as IntegrationEdgeTextStyle['writingDirection'] } })}
              className="h-7 text-[11px]"
            >
              <option value="automatic">Automatic</option>
              <option value="ltr">Left to Right</option>
              <option value="rtl">Right to Left</option>
            </Select>
          </div>
        </div>
        <CheckboxRow
          label="Font Color"
          checked={textStyle.fontColorEnabled}
          onChange={(fontColorEnabled) => commit({ textStyle: { fontColorEnabled } })}
          color={textStyle.fontColor}
          onColorChange={(fontColor) => commit({ textStyle: { fontColor, fontColorEnabled: true } })}
        />
        <CheckboxRow
          label="Background Color"
          checked={textStyle.backgroundColorEnabled}
          onChange={(backgroundColorEnabled) => commit({ textStyle: { backgroundColorEnabled } })}
          color={textStyle.backgroundColor}
          onColorChange={(backgroundColor) => commit({ textStyle: { backgroundColor, backgroundColorEnabled: true } })}
        />
        <CheckboxRow
          label="Border Color"
          checked={textStyle.borderColorEnabled}
          onChange={(borderColorEnabled) => commit({ textStyle: { borderColorEnabled } })}
          color={textStyle.borderColor}
          onColorChange={(borderColor) => commit({ textStyle: { borderColor, borderColorEnabled: true } })}
        />
        <CheckboxRow label="Formatted Text" checked={textStyle.formattedText} onChange={(formattedText) => commit({ textStyle: { formattedText } })} />
        <CheckboxRow label="Word Wrap" checked={textStyle.wordWrap || textStyle.boxWidth > 0 || textStyle.boxHeight > 0} onChange={(wordWrap) => commit({ textStyle: { wordWrap } })} />
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper label="Box Width" suffix="px" value={Math.round(textStyle.boxWidth)} onChange={(boxWidth) => commit({ textStyle: { boxWidth: Math.max(0, boxWidth), wordWrap: boxWidth > 0 || textStyle.wordWrap } })} />
          <NumberStepper label="Box Height" suffix="px" value={Math.round(textStyle.boxHeight)} onChange={(boxHeight) => commit({ textStyle: { boxHeight: Math.max(0, boxHeight), wordWrap: boxHeight > 0 || textStyle.wordWrap } })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={PANEL_LABEL_CLASS}>Opacity</span>
          <div className="w-28">
            <NumberStepper label="" suffix="%" value={textStyle.opacity} onChange={(opacity) => commit({ textStyle: { opacity: Math.max(0, Math.min(100, opacity)) } })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper label="Top" suffix="pt" value={textStyle.spacingTop} onChange={(spacingTop) => commit({ textStyle: { spacingTop } })} />
          <NumberStepper label="Global" suffix="pt" value={textStyle.spacingGlobal} onChange={(spacingGlobal) => commit({ textStyle: { spacingGlobal } })} />
          <NumberStepper label="Left" suffix="pt" value={textStyle.spacingLeft} onChange={(spacingLeft) => commit({ textStyle: { spacingLeft } })} />
          <NumberStepper label="Right" suffix="pt" value={textStyle.spacingRight} onChange={(spacingRight) => commit({ textStyle: { spacingRight } })} />
          <NumberStepper label="Bottom" suffix="pt" value={textStyle.spacingBottom} onChange={(spacingBottom) => commit({ textStyle: { spacingBottom } })} />
          <NumberStepper label="Line Height" suffix="%" value={textStyle.lineHeight} onChange={(lineHeight) => commit({ textStyle: { lineHeight } })} />
          <NumberStepper label="Angle" suffix="°" value={textStyle.angle} onChange={(angle) => commit({ textStyle: { angle } })} />
        </div>
      </div>

      <button type="button" className={cn(PANEL_MINI_BUTTON_CLASS, 'w-full')} onClick={() => commit({ textStyle: defaultIntegrationEdgeTextStyle() })}>
        Reset Text Style
      </button>
    </div>
  )

  const arrangeTab = (
    <div className="space-y-3">
      <div className={cn(PANEL_SECTION_CLASS, 'grid grid-cols-2 gap-2')}>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onChange({ zIndex: Math.max(edge.zIndex ?? 0, 20) + 10 })}>
          Bring to Front
        </button>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onChange({ zIndex: 0 })}>
          Send to Back
        </button>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onChange({ zIndex: (edge.zIndex ?? 0) + 1 })}>
          Bring Forward
        </button>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onChange({ zIndex: Math.max(0, (edge.zIndex ?? 0) - 1) })}>
          Send Backward
        </button>
      </div>

      <button
        type="button"
        className={cn(PANEL_MINI_BUTTON_CLASS, 'w-full')}
        onClick={() => onChange({
          source: edge.target,
          target: edge.source,
          sourceHandle: swapEdgeHandleRole(edge.targetHandle),
          targetHandle: swapEdgeHandleRole(edge.sourceHandle),
        })}
      >
        Reverse
      </button>

      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        <input type="checkbox" disabled checked={false} />
        Containable
      </label>

      <div className="space-y-2">
        <button
          type="button"
          className={cn(PANEL_MINI_BUTTON_CLASS, 'w-full')}
          onClick={() => {
            const payload = {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              label: edge.label ?? '',
              data: stored,
              style: edge.style ?? {},
            }
            void navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
          }}
        >
          Copy Data
        </button>
        <button
          type="button"
          className={cn(PANEL_MINI_BUTTON_CLASS, 'w-full')}
          onClick={() => {
            if (onClearWaypoints) {
              onClearWaypoints()
              return
            }
            onChange({ sourceHandle: undefined, targetHandle: undefined })
          }}
        >
          Clear Waypoints
        </button>
        <button
          type="button"
          className={cn(PANEL_MINI_BUTTON_CLASS, 'w-full')}
          onClick={() => {
            const next = window.prompt('Edit Link', stored.link ?? '')
            if (next === null) return
            commit({ link: next.trim() })
          }}
        >
          Edit Link
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-slate-200 bg-slate-100/90">
        <div
          role="button"
          tabIndex={0}
          aria-label="Geser panel Properties"
          className={cn(
            'flex shrink-0 touch-none cursor-grab select-none items-center border-r border-slate-200/80 px-2 active:cursor-grabbing',
            dragHandleProps.isDragging && 'cursor-grabbing',
          )}
          onPointerDown={dragHandleProps.onPointerDown}
          onPointerMove={dragHandleProps.onPointerMove}
          onPointerUp={dragHandleProps.onPointerUp}
          onPointerCancel={dragHandleProps.onPointerCancel}
        >
          <GripVertical className="h-4 w-4 text-slate-500" />
        </div>
        <button type="button" className={PANEL_TAB_CLASS(tab === 'style')} onClick={() => setTab('style')}>
          Style
        </button>
        <button type="button" className={PANEL_TAB_CLASS(tab === 'text')} onClick={() => setTab('text')}>
          Text
        </button>
        <button type="button" className={PANEL_TAB_CLASS(tab === 'arrange')} onClick={() => setTab('arrange')}>
          Arrange
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {tab === 'style' ? styleTab : null}
        {tab === 'text' ? textTab : null}
        {tab === 'arrange' ? arrangeTab : null}
      </div>
    </div>
  )
}
