import type { CSSProperties } from 'react'
import type { Node } from 'reactflow'
import { ARCHIMATE_NOTATION_LAYER_COLORS } from '@/modules/project-management/lib/integrationArchimateNotationCatalog'
import type {
  ArchimateLayer,
  ArchimateNodeData,
  IntegrationNodeTextStyle,
  IntegrationNodeVisualStyle,
} from '@/modules/project-management/lib/integrationArchitectureTypes'

export const INTEGRATION_STYLE_COLOR_PRESETS = [
  '#FFF3B0',
  '#C8EEF9',
  '#C8F0C8',
  '#fde68a',
  '#fca5a5',
  '#ddd6fe',
  '#ffffff',
  '#e2e8f0',
  '#fdba74',
  '#93c5fd',
  '#86efac',
  '#f472b6',
  '#cbd5e1',
  '#64748b',
  '#0f172a',
  '#334155',
] as const

export const INTEGRATION_FONT_FAMILIES = [
  'Helvetica',
  'Arial',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Georgia',
  'Times New Roman',
  'Courier New',
] as const

export function defaultIntegrationNodeVisual(layer?: ArchimateLayer): IntegrationNodeVisualStyle {
  const palette = layer ? ARCHIMATE_NOTATION_LAYER_COLORS[layer] : ARCHIMATE_NOTATION_LAYER_COLORS.application
  return {
    fillEnabled: true,
    fillColor: palette.bg,
    lineEnabled: true,
    lineColor: palette.border,
    lineWidth: 1,
    lineStyle: 'solid',
    opacity: 100,
    rounded: true,
    shadow: true,
    glass: false,
    sketch: false,
  }
}

export function defaultIntegrationNodeTextStyle(): IntegrationNodeTextStyle {
  return {
    fontFamily: 'Helvetica',
    fontSize: 12,
    bold: false,
    italic: false,
    underline: false,
    align: 'center',
    verticalAlign: 'middle',
    fontColor: '#0f172a',
    fontColorEnabled: true,
    wordWrap: false,
    opacity: 100,
    spacingTop: 0,
    spacingRight: 0,
    spacingBottom: 0,
    spacingLeft: 0,
    spacingGlobal: 2,
    angle: 0,
  }
}

export function resolveNodeVisual(
  visual: IntegrationNodeVisualStyle | undefined,
  layer?: ArchimateLayer,
): Required<IntegrationNodeVisualStyle> {
  return { ...defaultIntegrationNodeVisual(layer), ...visual }
}

export function resolveNodeTextStyle(textStyle: IntegrationNodeTextStyle | undefined): Required<IntegrationNodeTextStyle> {
  return { ...defaultIntegrationNodeTextStyle(), ...textStyle }
}

export function readIntegrationNodeSize(node: Node<ArchimateNodeData>): { width: number; height: number } {
  const style = node.style ?? {}
  const widthRaw = style.width ?? 200
  const heightRaw = style.height ?? (node.type === 'archimateBoundary' ? 280 : node.type === 'archimateNote' ? 72 : 89)
  const width = typeof widthRaw === 'number' ? widthRaw : Number.parseFloat(String(widthRaw)) || 200
  const height = typeof heightRaw === 'number' ? heightRaw : Number.parseFloat(String(heightRaw)) || 89
  return { width, height }
}

export function buildIntegrationNodeBoxStyle(
  visual: IntegrationNodeVisualStyle | undefined,
  layer?: ArchimateLayer,
): CSSProperties {
  const resolved = resolveNodeVisual(visual, layer)
  const backgroundColor = resolved.fillEnabled ? resolved.fillColor : 'transparent'
  const borderColor = resolved.lineEnabled ? resolved.lineColor : 'transparent'

  return {
    backgroundColor: resolved.glass ? `${backgroundColor}cc` : backgroundColor,
    borderColor,
    borderWidth: resolved.lineEnabled ? resolved.lineWidth : 0,
    borderStyle: resolved.lineStyle,
    opacity: resolved.opacity / 100,
    borderRadius: resolved.rounded ? 18 : 4,
    boxShadow: resolved.shadow ? '0 12px 30px -22px rgba(15,23,42,0.45)' : undefined,
    backdropFilter: resolved.glass ? 'blur(10px) saturate(140%)' : undefined,
    outline: resolved.sketch ? '1px dashed rgba(15,23,42,0.35)' : undefined,
  }
}

export function buildIntegrationNodeTextStyle(
  textStyle: IntegrationNodeTextStyle | undefined,
  fallbackColor = '#0f172a',
): CSSProperties {
  const resolved = resolveNodeTextStyle(textStyle)
  const global = resolved.spacingGlobal

  return {
    fontFamily: resolved.fontFamily,
    fontSize: resolved.fontSize,
    fontWeight: resolved.bold ? 700 : 400,
    fontStyle: resolved.italic ? 'italic' : 'normal',
    textDecoration: resolved.underline ? 'underline' : 'none',
    textAlign: resolved.align,
    alignItems:
      resolved.align === 'left' ? 'flex-start' : resolved.align === 'right' ? 'flex-end' : 'center',
    justifyContent:
      resolved.verticalAlign === 'top' ? 'flex-start' : resolved.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    color: resolved.fontColorEnabled ? resolved.fontColor : fallbackColor,
    opacity: resolved.opacity / 100,
    paddingTop: resolved.spacingTop + global,
    paddingRight: resolved.spacingRight + global,
    paddingBottom: resolved.spacingBottom + global,
    paddingLeft: resolved.spacingLeft + global,
    transform: resolved.angle ? `rotate(${resolved.angle}deg)` : undefined,
    whiteSpace: resolved.wordWrap ? 'normal' : 'nowrap',
    overflowWrap: resolved.wordWrap ? 'anywhere' : undefined,
  }
}
