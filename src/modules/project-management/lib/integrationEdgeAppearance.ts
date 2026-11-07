import type { CSSProperties } from 'react'
import type {
  IntegrationEdgeArrangeOptions,
  IntegrationEdgeArrow,
  IntegrationEdgeData,
  IntegrationEdgeLinePattern,
  IntegrationEdgeTextStyle,
  IntegrationEdgeVisualStyle,
} from '@/modules/project-management/lib/integrationArchitectureTypes'
import { defaultIntegrationNodeTextStyle } from '@/modules/project-management/lib/integrationNodeAppearance'

export function defaultIntegrationEdgeVisual(): Required<IntegrationEdgeVisualStyle> {
  return {
    lineEnabled: true,
    lineColor: '#334155',
    lineWidth: 2,
    lineStyle: 'solid',
    waypoints: 'rounded',
    startArrow: 'none',
    endArrow: 'classic',
    startFill: true,
    endFill: true,
    startSize: 6,
    endSize: 6,
    startSpacing: 0,
    endSpacing: 0,
    lineJumps: 'none',
    jumpSize: 6,
    opacity: 100,
    shadow: false,
    sketch: false,
  }
}

export function defaultIntegrationEdgeTextStyle(): Required<IntegrationEdgeTextStyle> {
  return {
    ...defaultIntegrationNodeTextStyle(),
    // C4 notation uses the canvas sans-serif face; edge labels should not inherit the generic node tracking.
    fontFamily: 'Arial',
    spacingGlobal: 0,
    position: 'center',
    writingDirection: 'automatic',
    formattedText: true,
    backgroundColorEnabled: false,
    backgroundColor: '#ffffff',
    borderColorEnabled: false,
    borderColor: '#cbd5e1',
    lineHeight: 120,
    offsetX: 0,
    offsetY: 0,
    boxWidth: 0,
    boxHeight: 0,
  }
}

export function defaultIntegrationEdgeArrange(): Required<IntegrationEdgeArrangeOptions> {
  return {
    movable: true,
    bendable: true,
    cloneable: true,
    deletable: true,
    editable: true,
    editDialog: true,
    noJumps: false,
    loopRouting: true,
    ignoreEdge: false,
    comic: false,
    snapToPoint: false,
    fixedDash: false,
    backgroundOutline: false,
    anchorDirection: true,
    sourceConstraint: 'None',
    targetConstraint: 'None',
    arcSize: 20,
    terminalSpacing: 0,
    fillOpacity: 100,
    strokeOpacity: 100,
    orthogonal: true,
    flowAnimation: false,
  }
}

export function readEdgeData(edge: { data?: unknown }): IntegrationEdgeData {
  return edge.data && typeof edge.data === 'object' ? (edge.data as IntegrationEdgeData) : {}
}

function decorationVisual(decoration: unknown): { arrow: IntegrationEdgeArrow; filled: boolean } | undefined {
  switch (decoration) {
    case 'none': return { arrow: 'none', filled: false }
    case 'arrow': return { arrow: 'open', filled: false }
    case 'triangle': return { arrow: 'block', filled: false }
    case 'diamond': return { arrow: 'diamond', filled: false }
    case 'filled-diamond': return { arrow: 'diamond', filled: true }
    default: return undefined
  }
}

export function resolveEdgeVisual(edge: { style?: CSSProperties; data?: unknown }): Required<IntegrationEdgeVisualStyle> {
  const data = readEdgeData(edge)
  const notation = data as IntegrationEdgeData & { sourceDecoration?: unknown; targetDecoration?: unknown; lineStyle?: unknown }
  const start = decorationVisual(notation.sourceDecoration), end = decorationVisual(notation.targetDecoration)
  const style = edge.style ?? {}
  const stroke = typeof style.stroke === 'string' ? style.stroke : undefined
  const width = Number(style.strokeWidth)
  const dashed = String(style.strokeDasharray ?? '').trim() !== ''
  const base = defaultIntegrationEdgeVisual()
  return {
    ...base,
    ...data.visual,
    lineColor: data.visual?.lineColor ?? stroke ?? base.lineColor,
    lineWidth: data.visual?.lineWidth ?? (Number.isFinite(width) && width > 0 ? width : base.lineWidth),
    lineStyle: data.visual?.lineStyle ?? (notation.lineStyle === 'dashed' || notation.lineStyle === 'solid' ? notation.lineStyle : dashed ? 'dashed' : base.lineStyle),
    startArrow: data.visual?.startArrow ?? start?.arrow ?? base.startArrow,
    endArrow: data.visual?.endArrow ?? end?.arrow ?? base.endArrow,
    startFill: data.visual?.startFill ?? start?.filled ?? base.startFill,
    endFill: data.visual?.endFill ?? end?.filled ?? base.endFill,
  }
}

export function resolveEdgeTextStyle(edge: { data?: unknown }): Required<IntegrationEdgeTextStyle> {
  const data = readEdgeData(edge)
  return { ...defaultIntegrationEdgeTextStyle(), ...data.textStyle }
}

export function resolveEdgeArrange(edge: { data?: unknown }): Required<IntegrationEdgeArrangeOptions> {
  const data = readEdgeData(edge)
  return { ...defaultIntegrationEdgeArrange(), ...data.arrange }
}

export function edgeDashArray(pattern: IntegrationEdgeLinePattern, width: number, fixedDash: boolean): string | undefined {
  if (pattern === 'solid') return undefined
  const w = Math.max(1, width)
  if (pattern === 'dotted') return fixedDash ? '2 4' : `${w} ${w * 2}`
  if (pattern === 'dashdot') return fixedDash ? '8 4 2 4' : `${w * 4} ${w * 2} ${w} ${w * 2}`
  return fixedDash ? '6 4' : `${w * 3} ${w * 2}`
}

export function edgeStrokeStyle(visual: Required<IntegrationEdgeVisualStyle>, arrange: Required<IntegrationEdgeArrangeOptions>): CSSProperties {
  const opacity = Math.max(0, Math.min(100, visual.opacity)) / 100
  const strokeOpacity = Math.max(0, Math.min(100, arrange.strokeOpacity)) / 100
  return {
    stroke: visual.lineEnabled ? visual.lineColor : 'transparent',
    strokeWidth: visual.lineWidth,
    strokeDasharray: edgeDashArray(visual.lineStyle, visual.lineWidth, arrange.fixedDash),
    opacity: opacity * strokeOpacity,
    filter: visual.shadow ? 'drop-shadow(0 1px 2px rgba(15,23,42,0.35))' : undefined,
    strokeLinecap: visual.sketch || arrange.comic ? 'round' : 'butt',
    strokeLinejoin: visual.waypoints === 'rounded' || visual.sketch || arrange.comic ? 'round' : 'miter',
  }
}
