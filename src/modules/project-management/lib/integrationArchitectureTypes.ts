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
  offsetX?: number
  offsetY?: number
  boxWidth?: number
  boxHeight?: number
}

export type IntegrationNodeArrangeOptions = {
  constrainProportions?: boolean
  recursiveResize?: boolean
  containable?: boolean
  frame?: boolean
}

export type IntegrationEdgeLinePattern = 'solid' | 'dashed' | 'dotted' | 'dashdot'
export type IntegrationEdgeWaypoints = 'sharp' | 'rounded' | 'curved'
export type IntegrationEdgeArrow = 'none' | 'classic' | 'block' | 'open' | 'oval' | 'diamond' | 'dash'
export type IntegrationEdgeJumpStyle = 'none' | 'arc' | 'gap' | 'sharp'

export type IntegrationEdgeVisualStyle = {
  lineEnabled?: boolean
  lineColor?: string
  lineWidth?: number
  lineStyle?: IntegrationEdgeLinePattern
  waypoints?: IntegrationEdgeWaypoints
  startArrow?: IntegrationEdgeArrow
  endArrow?: IntegrationEdgeArrow
  startFill?: boolean
  endFill?: boolean
  startSize?: number
  endSize?: number
  startSpacing?: number
  endSpacing?: number
  lineJumps?: IntegrationEdgeJumpStyle
  jumpSize?: number
  opacity?: number
  shadow?: boolean
  sketch?: boolean
}

export type IntegrationEdgeTextStyle = IntegrationNodeTextStyle & {
  position?: 'center' | 'source' | 'target'
  writingDirection?: 'automatic' | 'ltr' | 'rtl'
  formattedText?: boolean
  backgroundColorEnabled?: boolean
  backgroundColor?: string
  borderColorEnabled?: boolean
  borderColor?: string
  lineHeight?: number
  offsetX?: number
  offsetY?: number
  boxWidth?: number
  boxHeight?: number
}

export type IntegrationEdgeArrangeOptions = {
  movable?: boolean
  bendable?: boolean
  cloneable?: boolean
  deletable?: boolean
  editable?: boolean
  editDialog?: boolean
  noJumps?: boolean
  loopRouting?: boolean
  ignoreEdge?: boolean
  comic?: boolean
  snapToPoint?: boolean
  fixedDash?: boolean
  backgroundOutline?: boolean
  anchorDirection?: boolean
  sourceConstraint?: string
  targetConstraint?: string
  arcSize?: number
  terminalSpacing?: number
  fillOpacity?: number
  strokeOpacity?: number
  orthogonal?: boolean
  flowAnimation?: boolean
}

export type IntegrationEdgeData = {
  visual?: IntegrationEdgeVisualStyle
  textStyle?: IntegrationEdgeTextStyle
  arrange?: IntegrationEdgeArrangeOptions
  technology?: string
  link?: string
}

export type ArchimateElementNodeData = {
  kind: 'element'
  layer: ArchimateLayer
  stereotype: string
  title: string
  description: string[]
  notationId: string
  diagramLink?: string
  diagramLinkCleared?: boolean
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

export type ArchimateImageNodeData = {
  kind: 'image'
  src: string
  alt: string
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
  | ArchimateImageNodeData
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

export function isArchimateImageData(data: unknown): data is ArchimateImageNodeData {
  return typeof data === 'object' && data !== null && (data as ArchimateImageNodeData).kind === 'image'
}
