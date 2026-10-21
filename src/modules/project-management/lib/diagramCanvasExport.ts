import { jsPDF } from 'jspdf'
import type { Edge, Node } from 'reactflow'
import { resolveEdgeTextStyle } from '@/modules/project-management/lib/integrationEdgeAppearance'
import { resolveNodeVisual } from '@/modules/project-management/lib/integrationNodeAppearance'
import type {
  ArchimateElementNodeData,
  ArchimateNodeData,
  IntegrationNodeTextStyle,
  IntegrationNodeVisualStyle,
} from '@/modules/project-management/lib/integrationArchitectureTypes'

/**
 * Canvas export shared by the diagram studios (EditableDiagramCanvas: BPMN/C4/UML,
 * EditableIntegrationArchitectureCanvas: ArchiMate): one rendering for PNG, JPEG, SVG, PDF, print
 * and copy-as-image. Positions are absolute, so elements inside a boundary or lane (parent-relative
 * in React Flow) land where they are drawn.
 */
export type DiagramExportAction = 'jpeg' | 'png' | 'svg' | 'pdf' | 'copy-image' | 'print'

export function absoluteDiagramNodes(nodes: Node<ArchimateNodeData>[]): Node<ArchimateNodeData>[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const absolute = (node: Node<ArchimateNodeData>, depth = 0): { x: number; y: number } => {
    const parent = node.parentNode ? byId.get(node.parentNode) : undefined
    if (!parent || depth > 20) return node.position
    const origin = absolute(parent, depth + 1)
    return { x: origin.x + node.position.x, y: origin.y + node.position.y }
  }
  return nodes.map((node) => (node.parentNode ? { ...node, position: absolute(node) } : node))
}

/** The diagram drawn on a canvas element (only the given nodes when nodeIds is set); null when empty. */
export function renderDiagramCanvasImage(
  allNodes: Node<ArchimateNodeData>[],
  edges: Edge[],
  nodeIds?: string[],
): HTMLCanvasElement | null {
  const nodes = absoluteDiagramNodes(allNodes)
  const selectedIds = nodeIds ? new Set(nodeIds) : null
  const drawableNodes = nodes.filter((node) => node.type !== 'archimateLegend' && (!selectedIds || selectedIds.has(node.id)))
  if (drawableNodes.length === 0) return null
  const dimensions = (node: Node<ArchimateNodeData>) => {
    const measured = (node as Node<ArchimateNodeData> & { measured?: { width?: number; height?: number } }).measured
    return {
      width: Number(measured?.width ?? node.width ?? node.style?.width ?? 180),
      height: Number(measured?.height ?? node.height ?? node.style?.height ?? 72),
    }
  }
  const minX = Math.min(...drawableNodes.map((node) => node.position.x)) - 40
  const minY = Math.min(...drawableNodes.map((node) => node.position.y)) - 40
  const maxX = Math.max(...drawableNodes.map((node) => node.position.x + dimensions(node).width)) + 40
  const maxY = Math.max(...drawableNodes.map((node) => node.position.y + dimensions(node).height)) + 40
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(2400, Math.max(640, Math.ceil(maxX - minX)))
  canvas.height = Math.min(1800, Math.max(420, Math.ceil(maxY - minY)))
  const context = canvas.getContext('2d')
  if (!context) return null
  const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
    const safeRadius = Math.min(radius, width / 2, height / 2)
    context.beginPath()
    context.moveTo(x + safeRadius, y)
    context.lineTo(x + width - safeRadius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
    context.lineTo(x + width, y + height - safeRadius)
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
    context.lineTo(x + safeRadius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
    context.lineTo(x, y + safeRadius)
    context.quadraticCurveTo(x, y, x + safeRadius, y)
    context.closePath()
  }
  const wrapText = (text: string, maxWidth: number) => {
    const words = text.trim().split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line)
        line = word
      } else line = next
    })
    if (line) lines.push(line)
    return lines
  }
  const isDarkColor = (color: string) => {
    const match = /^#([\da-f]{6})$/i.exec(color)
    if (!match) return false
    const value = Number.parseInt(match[1], 16)
    const red = value >> 16
    const green = (value >> 8) & 255
    const blue = value & 255
    return (red * 299 + green * 587 + blue * 114) / 1000 < 145
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const drawEdges = () => edges.forEach((edge) => {
    const sourceNode = drawableNodes.find((node) => node.id === edge.source)
    const targetNode = drawableNodes.find((node) => node.id === edge.target)
    if (!sourceNode || !targetNode) return
    const sourceSize = dimensions(sourceNode)
    const targetSize = dimensions(targetNode)
    const sourceCenter = { x: sourceNode.position.x - minX + sourceSize.width / 2, y: sourceNode.position.y - minY + sourceSize.height / 2 }
    const targetCenter = { x: targetNode.position.x - minX + targetSize.width / 2, y: targetNode.position.y - minY + targetSize.height / 2 }
    const horizontal = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y)
    const start = horizontal
      ? { x: sourceCenter.x + (targetCenter.x >= sourceCenter.x ? sourceSize.width / 2 : -sourceSize.width / 2), y: sourceCenter.y }
      : { x: sourceCenter.x, y: sourceCenter.y + (targetCenter.y >= sourceCenter.y ? sourceSize.height / 2 : -sourceSize.height / 2) }
    const end = horizontal
      ? { x: targetCenter.x + (targetCenter.x >= sourceCenter.x ? -targetSize.width / 2 : targetSize.width / 2), y: targetCenter.y }
      : { x: targetCenter.x, y: targetCenter.y + (targetCenter.y >= sourceCenter.y ? -targetSize.height / 2 : targetSize.height / 2) }
    const stroke = typeof edge.style?.stroke === 'string' ? edge.style.stroke : '#64748b'
    const width = typeof edge.style?.strokeWidth === 'number' ? edge.style.strokeWidth : 1.5
    context.beginPath()
    context.strokeStyle = stroke
    context.lineWidth = width
    context.setLineDash(typeof edge.style?.strokeDasharray === 'string' ? edge.style.strokeDasharray.split(/[ ,]+/).map(Number).filter(Boolean) : [])
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.stroke()
    context.setLineDash([])
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    context.fillStyle = stroke
    context.beginPath()
    context.moveTo(end.x, end.y)
    context.lineTo(end.x - 9 * Math.cos(angle - Math.PI / 6), end.y - 9 * Math.sin(angle - Math.PI / 6))
    context.lineTo(end.x - 9 * Math.cos(angle + Math.PI / 6), end.y - 9 * Math.sin(angle + Math.PI / 6))
    context.closePath()
    context.fill()
    if (edge.label) {
      const label = String(edge.label)
      const textStyle = resolveEdgeTextStyle(edge)
      context.font = `${textStyle.italic ? 'italic ' : ''}${textStyle.bold ? 700 : 400} ${textStyle.fontSize}px ${textStyle.fontFamily}`
      const labelWidth = Math.min(Math.max(88, context.measureText(label).width + 18), 420)
      const labelX = (start.x + end.x) / 2 - labelWidth / 2
      const labelY = (start.y + end.y) / 2 + 12
      roundedRect(labelX, labelY, labelWidth, 24, 5)
      context.fillStyle = '#ffffff'
      context.fill()
      context.strokeStyle = '#cbd5e1'
      context.lineWidth = 1
      context.stroke()
      context.fillStyle = '#0f172a'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(label, labelX + labelWidth / 2, labelY + 12, labelWidth - 12)
    }
  })
  const drawNode = (node: Node<ArchimateNodeData>) => {
    const styled = node.data as ArchimateNodeData & { visual?: IntegrationNodeVisualStyle; textStyle?: IntegrationNodeTextStyle }
    const { width, height } = dimensions(node)
    const x = node.position.x - minX
    const y = node.position.y - minY
    // ArchiMate elements take their layer's colours, as on the canvas (ArchimateElementNode).
    const visual = node.type === 'archimateElement' && node.data.kind === 'element'
      ? resolveNodeVisual(styled.visual, (node.data as ArchimateElementNodeData).layer)
      : styled.visual
    const fillColor = visual?.fillEnabled === false ? '#ffffff' : visual?.fillColor ?? '#ffffff'
    const lineColor = visual?.lineEnabled === false ? 'transparent' : visual?.lineColor ?? '#334155'
    const textColor = styled.textStyle?.fontColorEnabled
      ? styled.textStyle.fontColor ?? '#0f172a'
      : isDarkColor(fillColor) ? '#ffffff' : '#0f172a'
    if (visual?.shadow) {
      context.shadowColor = 'rgba(15,23,42,0.2)'
      context.shadowBlur = 10
      context.shadowOffsetY = 4
    }
    roundedRect(x, y, width, height, visual?.rounded === false ? 3 : 12)
    context.globalAlpha = (visual?.opacity ?? 100) / 100
    context.fillStyle = fillColor
    context.fill()
    context.shadowColor = 'transparent'
    context.globalAlpha = 1
    if (lineColor !== 'transparent') {
      context.strokeStyle = lineColor
      context.lineWidth = visual?.lineWidth ?? 1.5
      context.setLineDash(visual?.lineStyle === 'dashed' ? [7, 4] : visual?.lineStyle === 'dotted' ? [2, 3] : [])
      context.stroke()
      context.setLineDash([])
    }
    const elementData = node.data.kind === 'element' ? node.data : null
    if (elementData?.notationId.includes('Person')) {
      const personColor = lineColor === 'transparent' ? '#0f5d9d' : lineColor
      const centerX = x + width / 2
      context.strokeStyle = personColor
      context.fillStyle = fillColor
      context.lineWidth = 1.5
      context.beginPath()
      context.arc(centerX, y - 6, 6, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      context.beginPath()
      context.moveTo(centerX - 14, y + 14)
      context.bezierCurveTo(centerX - 12, y + 4, centerX - 4, y, centerX, y)
      context.bezierCurveTo(centerX + 4, y, centerX + 12, y + 4, centerX + 14, y + 14)
      context.closePath()
      context.fill()
      context.stroke()
    }
    const fontFamily = styled.textStyle?.fontFamily ?? 'Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    if (elementData?.stereotype) {
      context.fillStyle = textColor
      context.font = `italic ${Math.max(9, (styled.textStyle?.fontSize ?? 12) - 2)}px ${fontFamily}`
      context.fillText(`<<${elementData.stereotype.toLowerCase()}>>`, x + width / 2, y + 23, width - 20)
    }
    const title = node.data.kind === 'element' || node.data.kind === 'boundary' || node.data.kind === 'note' ? node.data.title : node.id
    context.fillStyle = textColor
    context.font = `${styled.textStyle?.bold === false ? 500 : 700} ${Math.max(11, styled.textStyle?.fontSize ?? 14)}px ${fontFamily}`
    const titleLines = wrapText(title, Math.max(40, width - 20)).slice(0, 2)
    const titleY = elementData?.stereotype ? y + 46 : y + height / 2 - 8
    titleLines.forEach((line, index) => context.fillText(line, x + width / 2, titleY + index * 16, width - 20))
    const description = elementData?.description.filter((line) => !/^\[.*\]$/.test(line)) ?? (node.data.kind === 'note' ? node.data.lines : [])
    if (description.length) {
      context.font = `${Math.max(9, (styled.textStyle?.fontSize ?? 12) - 2)}px ${fontFamily}`
      const descriptionLines = description.flatMap((line) => wrapText(line, Math.max(40, width - 24))).slice(0, 3)
      const descriptionY = titleY + titleLines.length * 16 + 12
      descriptionLines.forEach((line, index) => context.fillText(line, x + width / 2, descriptionY + index * 12, width - 24))
    }
  }
  // Boundaries (layers, lanes) first, then the connections, then the elements: a boundary's fill
  // would otherwise hide every connection that crosses it.
  const isContainer = (node: Node<ArchimateNodeData>) => node.data.kind === 'boundary'
  drawableNodes.filter(isContainer).forEach(drawNode)
  drawEdges()
  drawableNodes.filter((node) => !isContainer(node)).forEach(drawNode)
  return canvas
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export async function downloadDiagramImage(canvas: HTMLCanvasElement, name: string, mimeType: 'image/png' | 'image/jpeg') {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.95))
  if (blob) downloadBlob(blob, `${name}.${mimeType === 'image/png' ? 'png' : 'jpeg'}`)
}

export function downloadDiagramSvg(canvas: HTMLCanvasElement, name: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image href="${canvas.toDataURL('image/png')}" width="${canvas.width}" height="${canvas.height}" /></svg>`
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`)
}

export function downloadDiagramPdf(canvas: HTMLCanvasElement, name: string) {
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height)
  pdf.save(`${name}.pdf`)
}

export function printDiagram(canvas: HTMLCanvasElement, name: string) {
  const printWindow = window.open('', '_blank', 'width=1200,height=900')
  if (!printWindow) return
  printWindow.opener = null
  printWindow.document.write(`<!doctype html><html><head><title>${name}</title><style>body{margin:24px;background:#fff}img{display:block;max-width:100%;height:auto}</style></head><body><img src="${canvas.toDataURL('image/png')}" alt="${name}" /></body></html>`)
  printWindow.document.close()
  printWindow.addEventListener('load', () => printWindow.print(), { once: true })
}

/** Copies the image to the clipboard; downloads it as PNG when the clipboard refuses. */
export async function copyDiagramImage(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  } catch {
    downloadBlob(blob, `${name}.png`)
  }
}

/** Runs one export action on the diagram (the Export menu of the Idea page). */
export async function runDiagramExportAction(
  action: DiagramExportAction,
  nodes: Node<ArchimateNodeData>[],
  edges: Edge[],
  name: string,
) {
  const canvas = renderDiagramCanvasImage(nodes, edges)
  if (!canvas) return
  if (action === 'png') await downloadDiagramImage(canvas, name, 'image/png')
  if (action === 'jpeg') await downloadDiagramImage(canvas, name, 'image/jpeg')
  if (action === 'svg') downloadDiagramSvg(canvas, name)
  if (action === 'pdf') downloadDiagramPdf(canvas, name)
  if (action === 'copy-image') await copyDiagramImage(canvas, name)
  if (action === 'print') printDiagram(canvas, name)
}
