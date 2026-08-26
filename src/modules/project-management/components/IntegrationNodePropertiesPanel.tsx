import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  GripVertical,
  Italic,
  RotateCw,
  Underline,
} from 'lucide-react'
import type { Node } from 'reactflow'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  INTEGRATION_FONT_FAMILIES,
  INTEGRATION_STYLE_COLOR_PRESETS,
  defaultIntegrationNodeTextStyle,
  defaultIntegrationNodeVisual,
  readIntegrationNodeSize,
  resolveNodeTextStyle,
  resolveNodeVisual,
} from '@/modules/project-management/lib/integrationNodeAppearance'
import type {
  ArchimateElementNodeData,
  ArchimateNodeData,
  IntegrationNodeArrangeOptions,
  IntegrationNodeTextStyle,
  IntegrationNodeVisualStyle,
} from '@/modules/project-management/lib/integrationArchitectureTypes'
import { isArchimateElementData } from '@/modules/project-management/lib/integrationArchitectureTypes'

type PropertiesTab = 'style' | 'text' | 'arrange'

export type IntegrationPropertiesPanelDragHandleProps = {
  isDragging: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
}

type IntegrationNodePropertiesPanelProps = {
  selectedNode: Node<ArchimateNodeData>
  onUpdateData: (patch: Record<string, unknown>) => void
  onUpdateSize: (width: number, height: number) => void
  onUpdatePosition: (x: number, y: number) => void
  onLayerAction: (action: 'front' | 'back' | 'forward' | 'backward') => void
  onRotate90: () => void
  dragHandleProps?: IntegrationPropertiesPanelDragHandleProps
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

function NumberStepper({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  onChange: (value: number) => void
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
            onClick={() => onChange(value + 1)}
            aria-label={`Increase ${label}`}
          >
            ▲
          </button>
          <button
            type="button"
            className="inline-flex h-3.5 w-5 items-center justify-center rounded-b border border-t-0 border-slate-300 bg-slate-50 text-[9px] leading-none"
            onClick={() => onChange(Math.max(0, value - 1))}
            aria-label={`Decrease ${label}`}
          >
            ▼
          </button>
        </div>
        {suffix ? <span className="text-[10px] text-slate-500">{suffix}</span> : null}
      </div>
      <p className="text-center text-[10px] text-slate-500">{label}</p>
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
          value={color ?? '#ffffff'}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          aria-label={`${label} color`}
        />
      ) : null}
    </div>
  )
}

export function IntegrationNodePropertiesPanel({
  selectedNode,
  onUpdateData,
  onUpdateSize,
  onUpdatePosition,
  onLayerAction,
  onRotate90,
  dragHandleProps,
}: IntegrationNodePropertiesPanelProps) {
  const [tab, setTab] = useState<PropertiesTab>('style')
  const elementData = isArchimateElementData(selectedNode.data) ? selectedNode.data : null
  const layer = elementData?.layer
  const visual = resolveNodeVisual(selectedNode.data.visual, layer)
  const textStyle = resolveNodeTextStyle(selectedNode.data.textStyle)
  const arrange = selectedNode.data.arrange ?? {}
  const size = useMemo(() => readIntegrationNodeSize(selectedNode), [selectedNode])

  const patchVisual = (patch: Partial<IntegrationNodeVisualStyle>) => {
    onUpdateData({ visual: { ...selectedNode.data.visual, ...patch } })
  }

  const patchTextStyle = (patch: Partial<IntegrationNodeTextStyle>) => {
    onUpdateData({ textStyle: { ...selectedNode.data.textStyle, ...patch } })
  }

  const patchArrange = (patch: Partial<IntegrationNodeArrangeOptions>) => {
    onUpdateData({ arrange: { ...arrange, ...patch } })
  }

  const patchElementField = (field: keyof ArchimateElementNodeData, value: string | string[]) => {
    onUpdateData({ [field]: value })
  }

  const applyPresetColor = (color: string) => {
    patchVisual({ fillEnabled: true, fillColor: color, lineEnabled: true, lineColor: '#334155' })
  }

  const resetVisual = () => onUpdateData({ visual: defaultIntegrationNodeVisual(layer) })
  const resetTextStyle = () => onUpdateData({ textStyle: defaultIntegrationNodeTextStyle() })

  const styleTab = (
    <div className="space-y-3">
      <div className={PANEL_SECTION_CLASS}>
        <div className="grid grid-cols-8 gap-1">
          {INTEGRATION_STYLE_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className="h-5 w-full rounded border border-slate-300/80"
              style={{ backgroundColor: color }}
              onClick={() => applyPresetColor(color)}
              aria-label={`Preset ${color}`}
            />
          ))}
        </div>
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <CheckboxRow
          label="Fill"
          checked={visual.fillEnabled}
          onChange={(fillEnabled) => patchVisual({ fillEnabled })}
          color={visual.fillColor}
          onColorChange={(fillColor) => patchVisual({ fillColor, fillEnabled: true })}
        />
        <CheckboxRow
          label="Line"
          checked={visual.lineEnabled}
          onChange={(lineEnabled) => patchVisual({ lineEnabled })}
          color={visual.lineColor}
          onColorChange={(lineColor) => patchVisual({ lineColor, lineEnabled: true })}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Select
            value={visual.lineStyle}
            onChange={(event) => patchVisual({ lineStyle: event.target.value as IntegrationNodeVisualStyle['lineStyle'] })}
            className="h-7 text-[11px]"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </Select>
          <div className="w-24">
            <NumberStepper
              label="Width"
              suffix="pt"
              value={visual.lineWidth}
              onChange={(lineWidth) => patchVisual({ lineWidth })}
            />
          </div>
        </div>
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <div className="flex items-center justify-between gap-2">
          <span className={PANEL_LABEL_CLASS}>Opacity</span>
          <div className="w-28">
            <NumberStepper label="" suffix="%" value={visual.opacity} onChange={(opacity) => patchVisual({ opacity })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CheckboxRow label="Rounded" checked={visual.rounded} onChange={(rounded) => patchVisual({ rounded })} />
          <CheckboxRow label="Shadow" checked={visual.shadow} onChange={(shadow) => patchVisual({ shadow })} />
          <CheckboxRow label="Glass" checked={visual.glass} onChange={(glass) => patchVisual({ glass })} />
          <CheckboxRow label="Sketch" checked={visual.sketch} onChange={(sketch) => patchVisual({ sketch })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={resetVisual}>
          Reset Style
        </button>
        <button
          type="button"
          className={PANEL_MINI_BUTTON_CLASS}
          onClick={() => patchVisual({ fillColor: visual.lineColor, lineColor: visual.fillColor })}
        >
          Swap Fill/Line
        </button>
      </div>
    </div>
  )

  const textTab = (
    <div className="space-y-3">
      {elementData ? (
        <div className={PANEL_SECTION_CLASS}>
          <div className="space-y-1.5">
            <label className={PANEL_LABEL_CLASS}>Judul</label>
            <Input
              value={elementData.title}
              onChange={(event) => patchElementField('title', event.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <label className={PANEL_LABEL_CLASS}>Stereotype</label>
            <Input
              value={elementData.stereotype}
              onChange={(event) => patchElementField('stereotype', event.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <label className={PANEL_LABEL_CLASS}>Deskripsi</label>
            <Textarea
              value={elementData.description.join('\n')}
              onChange={(event) =>
                patchElementField(
                  'description',
                  event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                )
              }
              rows={3}
              className="resize-y text-sm"
            />
          </div>
        </div>
      ) : selectedNode.data.kind === 'boundary' ? (
        <div className={PANEL_SECTION_CLASS}>
          <label className={PANEL_LABEL_CLASS}>Judul boundary</label>
          <Input
            value={selectedNode.data.title}
            onChange={(event) => onUpdateData({ title: event.target.value })}
            className="h-8"
          />
        </div>
      ) : selectedNode.data.kind === 'note' ? (
        <div className={PANEL_SECTION_CLASS}>
          <div className="space-y-1.5">
            <label className={PANEL_LABEL_CLASS}>Judul catatan</label>
            <Input
              value={selectedNode.data.title}
              onChange={(event) => onUpdateData({ title: event.target.value })}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <label className={PANEL_LABEL_CLASS}>Isi catatan</label>
            <Textarea
              value={selectedNode.data.lines.join('\n')}
              onChange={(event) =>
                onUpdateData({
                  lines: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
              rows={3}
              className="resize-y text-sm"
            />
          </div>
        </div>
      ) : null}

      <div className={PANEL_SECTION_CLASS}>
        <Select
          value={textStyle.fontFamily}
          onChange={(event) => patchTextStyle({ fontFamily: event.target.value })}
          className="h-8 w-full text-[11px]"
        >
          {INTEGRATION_FONT_FAMILIES.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={PANEL_TOGGLE_CLASS(textStyle.bold)}
            onClick={() => patchTextStyle({ bold: !textStyle.bold })}
            aria-label="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={PANEL_TOGGLE_CLASS(textStyle.italic)}
            onClick={() => patchTextStyle({ italic: !textStyle.italic })}
            aria-label="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={PANEL_TOGGLE_CLASS(textStyle.underline)}
            onClick={() => patchTextStyle({ underline: !textStyle.underline })}
            aria-label="Underline"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <div className="ml-auto w-24">
            <NumberStepper
              label="Size"
              suffix="pt"
              value={textStyle.fontSize}
              onChange={(fontSize) => patchTextStyle({ fontSize })}
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={PANEL_TOGGLE_CLASS(textStyle.align === 'left')}
            onClick={() => patchTextStyle({ align: 'left' })}
            aria-label="Align left"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={PANEL_TOGGLE_CLASS(textStyle.align === 'center')}
            onClick={() => patchTextStyle({ align: 'center' })}
            aria-label="Align center"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={PANEL_TOGGLE_CLASS(textStyle.align === 'right')}
            onClick={() => patchTextStyle({ align: 'right' })}
            aria-label="Align right"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className={PANEL_TOGGLE_CLASS(textStyle.verticalAlign === 'top')}
              onClick={() => patchTextStyle({ verticalAlign: 'top' })}
              aria-label="Align top"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={PANEL_TOGGLE_CLASS(textStyle.verticalAlign === 'middle')}
              onClick={() => patchTextStyle({ verticalAlign: 'middle' })}
              aria-label="Align middle"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={PANEL_TOGGLE_CLASS(textStyle.verticalAlign === 'bottom')}
              onClick={() => patchTextStyle({ verticalAlign: 'bottom' })}
              aria-label="Align bottom"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <CheckboxRow
          label="Font Color"
          checked={textStyle.fontColorEnabled}
          onChange={(fontColorEnabled) => patchTextStyle({ fontColorEnabled })}
          color={textStyle.fontColor}
          onColorChange={(fontColor) => patchTextStyle({ fontColor, fontColorEnabled: true })}
        />
        <CheckboxRow label="Word Wrap" checked={textStyle.wordWrap} onChange={(wordWrap) => patchTextStyle({ wordWrap })} />
        <div className="flex items-center justify-between gap-2">
          <span className={PANEL_LABEL_CLASS}>Opacity</span>
          <div className="w-28">
            <NumberStepper
              label=""
              suffix="%"
              value={textStyle.opacity}
              onChange={(opacity) => patchTextStyle({ opacity })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper label="Top" suffix="pt" value={textStyle.spacingTop} onChange={(spacingTop) => patchTextStyle({ spacingTop })} />
          <NumberStepper label="Global" suffix="pt" value={textStyle.spacingGlobal} onChange={(spacingGlobal) => patchTextStyle({ spacingGlobal })} />
          <NumberStepper label="Left" suffix="pt" value={textStyle.spacingLeft} onChange={(spacingLeft) => patchTextStyle({ spacingLeft })} />
          <NumberStepper label="Right" suffix="pt" value={textStyle.spacingRight} onChange={(spacingRight) => patchTextStyle({ spacingRight })} />
          <NumberStepper label="Bottom" suffix="pt" value={textStyle.spacingBottom} onChange={(spacingBottom) => patchTextStyle({ spacingBottom })} />
          <NumberStepper label="Angle" suffix="°" value={textStyle.angle} onChange={(angle) => patchTextStyle({ angle })} />
        </div>
      </div>

      <button type="button" className={cn(PANEL_MINI_BUTTON_CLASS, 'w-full')} onClick={resetTextStyle}>
        Reset Text Style
      </button>
    </div>
  )

  const updateSizeWithConstraint = (nextWidth: number, nextHeight: number, changed: 'width' | 'height') => {
    if (!arrange.constrainProportions) {
      onUpdateSize(nextWidth, nextHeight)
      return
    }
    const ratio = size.width / Math.max(size.height, 1)
    if (changed === 'width') {
      onUpdateSize(nextWidth, Math.max(24, Math.round(nextWidth / ratio)))
      return
    }
    onUpdateSize(Math.max(24, Math.round(nextHeight * ratio)), nextHeight)
  }

  const arrangeTab = (
    <div className="space-y-3">
      <div className={cn(PANEL_SECTION_CLASS, 'grid grid-cols-2 gap-2')}>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onLayerAction('front')}>
          Bring to Front
        </button>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onLayerAction('back')}>
          Send to Back
        </button>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onLayerAction('forward')}>
          Bring Forward
        </button>
        <button type="button" className={PANEL_MINI_BUTTON_CLASS} onClick={() => onLayerAction('backward')}>
          Send Backward
        </button>
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <p className={PANEL_LABEL_CLASS}>Size</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper
            label="Width"
            suffix="pt"
            value={Math.round(size.width)}
            onChange={(width) => updateSizeWithConstraint(width, size.height, 'width')}
          />
          <NumberStepper
            label="Height"
            suffix="pt"
            value={Math.round(size.height)}
            onChange={(height) => updateSizeWithConstraint(size.width, height, 'height')}
          />
        </div>
        <CheckboxRow
          label="Constrain Proportions"
          checked={Boolean(arrange.constrainProportions)}
          onChange={(constrainProportions) => patchArrange({ constrainProportions })}
        />
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <p className={PANEL_LABEL_CLASS}>Position</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper
            label="Left"
            suffix="pt"
            value={Math.round(selectedNode.position.x)}
            onChange={(x) => onUpdatePosition(x, selectedNode.position.y)}
          />
          <NumberStepper
            label="Top"
            suffix="pt"
            value={Math.round(selectedNode.position.y)}
            onChange={(y) => onUpdatePosition(selectedNode.position.x, y)}
          />
        </div>
      </div>

      <div className={PANEL_SECTION_CLASS}>
        <div className="flex items-center gap-2">
          <span className={PANEL_LABEL_CLASS}>Angle</span>
          <div className="ml-auto w-28">
            <NumberStepper label="" suffix="°" value={textStyle.angle} onChange={(angle) => patchTextStyle({ angle })} />
          </div>
        </div>
        <button type="button" className={cn(PANEL_MINI_BUTTON_CLASS, 'w-full gap-1')} onClick={onRotate90}>
          <RotateCw className="h-3.5 w-3.5" />
          Rotate shape only by 90°
        </button>
      </div>

      <div className="space-y-2">
        <CheckboxRow
          label="Containable"
          checked={
            selectedNode.type === 'archimateBoundary'
              ? arrange.containable !== false
              : arrange.containable === true
          }
          onChange={(containable) => patchArrange({ containable })}
        />
        <CheckboxRow
          label="Recursive Resize"
          checked={arrange.recursiveResize ?? true}
          onChange={(recursiveResize) => patchArrange({ recursiveResize })}
        />
        <CheckboxRow label="Frame" checked={Boolean(arrange.frame)} onChange={(frame) => patchArrange({ frame })} />
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-slate-200 bg-slate-100/90">
        {dragHandleProps ? (
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
        ) : null}
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
