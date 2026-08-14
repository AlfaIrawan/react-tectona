export type ArchimateLayer = 'business' | 'application' | 'data' | 'technology'

export type IntegrationNodeVisualStyle = {
  fillEnabled?: boolean
  fillColor?: string
  lineEnabled?: boolean
  lineColor?: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  opacity?: number
  rounded?: boolean
  shadow?: boolean
  glass?: boolean
  sketch?: boolean
}

export type IntegrationNodeTextStyle = {
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  fontColor?: string
  fontColorEnabled?: boolean
  wordWrap?: boolean
  opacity?: number
  spacingTop?: number
  spacingRight?: number
  spacingBottom?: number
  spacingLeft?: number
  spacingGlobal?: number
  angle?: number
}

export type IntegrationNodeArrangeOptions = {
  constrainProportions?: boolean
  recursiveResize?: boolean
  containable?: boolean
  frame?: boolean
}

export type ArchimateElementNodeData = {
  kind: 'element'
  layer: ArchimateLayer
  stereotype: string
  title: string
  description: string[]
  notationId: string
  visual?: IntegrationNodeVisualStyle
  textStyle?: IntegrationNodeTextStyle
  arrange?: IntegrationNodeArrangeOptions
}

export type ArchimateBoundaryNodeData = {
  kind: 'boundary'
  title: string
  visual?: IntegrationNodeVisualStyle
  textStyle?: IntegrationNodeTextStyle
  arrange?: IntegrationNodeArrangeOptions
}

export type ArchimateNoteNodeData = {
  kind: 'note'
  title: string
  lines: string[]
  visual?: IntegrationNodeVisualStyle
  textStyle?: IntegrationNodeTextStyle
  arrange?: IntegrationNodeArrangeOptions
}

export type ArchimateLegendNodeData = {
  kind: 'legend'
}

export type ArchimateNodeData =
  | ArchimateElementNodeData
  | ArchimateBoundaryNodeData
  | ArchimateNoteNodeData
  | ArchimateLegendNodeData

export function isArchimateElementData(data: unknown): data is ArchimateElementNodeData {
  return typeof data === 'object' && data !== null && (data as ArchimateElementNodeData).kind === 'element'
}

export function isArchimateBoundaryData(data: unknown): data is ArchimateBoundaryNodeData {
  return typeof data === 'object' && data !== null && (data as ArchimateBoundaryNodeData).kind === 'boundary'
}

export function isArchimateNoteData(data: unknown): data is ArchimateNoteNodeData {
  return typeof data === 'object' && data !== null && (data as ArchimateNoteNodeData).kind === 'note'
}
