import { MarkerType, type Edge, type Node } from 'reactflow'
import { normalizeIntegrationNodesForCanvas } from '@/modules/project-management/lib/integrationArchitectureDefaults'
import {
  inferArchimateNotationId,
  normalizeArchimateElementData,
  resolveArchimateFromLabel,
} from '@/modules/project-management/lib/integrationArchimateNotationCatalog'
import type {
  ArchimateElementNodeData,
  ArchimateLayer,
  ArchimateNodeData,
} from '@/modules/project-management/lib/integrationArchitectureTypes'

export type PlantUmlParseResult = {
  nodes: Node<ArchimateNodeData>[]
  edges: Edge[]
  warnings: string[]
}

type ParsedPlantNode = {
  id: string
  label: string
  packageId: string | null
  kind: 'component' | 'node' | 'database' | 'actor'
}

type ParsedPackage = {
  id: string
  title: string
}

function slugifyId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'node'
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}_${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

function stripPlantUmlBlock(source: string): string[] {
  const normalized = source.replace(/\r\n/g, '\n')
  const start = normalized.search(/@startuml/i)
  const end = normalized.search(/@enduml/i)
  const body = start >= 0 && end > start ? normalized.slice(start, end) : normalized
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("'") && !/^@startuml/i.test(line))
}

function inferLayer(kind: ParsedPlantNode['kind'], label: string): ArchimateLayer {
  const fromLabel = resolveArchimateFromLabel(label)
  if (fromLabel) return fromLabel.layer

  if (kind === 'actor') return 'business'
  if (kind === 'database') return 'data'
  if (kind === 'node') return 'technology'
  const lowered = label.toLowerCase()
  if (lowered.includes('data') || lowered.includes('paket') || lowered.includes('insight')) return 'data'
  if (
    lowered.includes('platform') ||
    lowered.includes('crm') ||
    lowered.includes('erp') ||
    lowered.includes('eksternal')
  ) {
    return 'technology'
  }
  if (
    lowered.includes('komite') ||
    lowered.includes('governance') ||
    lowered.includes('role') ||
    lowered.startsWith('business ')
  ) {
    return 'business'
  }
  return 'application'
}

function buildElementData(member: ParsedPlantNode): ArchimateElementNodeData {
  const fromLabel = resolveArchimateFromLabel(member.label)
  if (fromLabel) {
    return normalizeArchimateElementData({
      kind: 'element',
      layer: fromLabel.layer,
      stereotype: fromLabel.stereotype,
      title: member.label,
      description: [],
      notationId: fromLabel.notationId,
    })
  }

  const layer = inferLayer(member.kind, member.label)
  const stereotype = inferStereotype(layer, member.kind, member.label)
  return normalizeArchimateElementData({
    kind: 'element',
    layer,
    stereotype,
    title: member.label,
    description: [],
    notationId: inferArchimateNotationId(layer, stereotype),
  })
}

function inferStereotype(layer: ArchimateLayer, kind: ParsedPlantNode['kind'], label?: string): string {
  const fromLabel = label ? resolveArchimateFromLabel(label) : null
  if (fromLabel) return fromLabel.stereotype

  if (kind === 'actor') return 'Business Role'
  if (kind === 'database') return 'Data Object'
  if (layer === 'business') return 'Business Role'
  if (layer === 'data') return 'Data Object'
  if (layer === 'technology' || kind === 'node') return 'Technology Node'
  if (kind === 'component') return 'Application Component'
  return 'Application Service'
}

function parseNodeLine(line: string, packageId: string | null, usedIds: Set<string>): ParsedPlantNode | null {
  const bracketMatch = line.match(/^\[(.+?)\](?:\s+as\s+([A-Za-z0-9_]+))?$/i)
  if (bracketMatch) {
    const label = bracketMatch[1].trim()
    const id = uniqueId(bracketMatch[2]?.trim() || slugifyId(label), usedIds)
    return { id, label, packageId, kind: 'component' }
  }

  const quotedMatch = line.match(/^(component|node|database|actor)\s+"([^"]+)"(?:\s+as\s+([A-Za-z0-9_]+))?$/i)
  if (quotedMatch) {
    const kind = quotedMatch[1].toLowerCase() as ParsedPlantNode['kind']
    const label = quotedMatch[2].trim()
    const id = uniqueId(quotedMatch[3]?.trim() || slugifyId(label), usedIds)
    return { id, label, packageId, kind }
  }

  const aliasMatch = line.match(/^([A-Za-z0-9_]+)\s+\[(.+?)\]$/i)
  if (aliasMatch) {
    const id = uniqueId(aliasMatch[1], usedIds)
    return { id, label: aliasMatch[2].trim(), packageId, kind: 'component' }
  }

  return null
}

function parseEdgeLine(
  line: string,
): { source: string; target: string; label?: string; style: 'serving' | 'flow' | 'access' } | null {
  const edgeMatch = line.match(
    /^([A-Za-z0-9_]+)\s+(?:-\[(?:\w+)\]->|-->|\.{2,}>|\.\.>>|->|<\.{2,}|\.{2,}<)\s+([A-Za-z0-9_]+)(?:\s*:\s*(.+))?$/,
  )
  if (!edgeMatch) return null

  const label = edgeMatch[3]?.trim()
  const isDotted = line.includes('..>') || line.includes('..>>') || line.includes('<..')
  let style: 'serving' | 'flow' | 'access' = isDotted ? 'flow' : 'serving'
  if (label?.toLowerCase() === 'access') style = 'access'
  if (label?.toLowerCase() === 'flow') style = 'flow'
  if (label?.toLowerCase() === 'serving') style = 'serving'

  return {
    source: edgeMatch[1],
    target: edgeMatch[2],
    label: label || undefined,
    style,
  }
}

function layoutIntegrationGraph(
  parsedNodes: ParsedPlantNode[],
  packages: ParsedPackage[],
  edges: Array<{ source: string; target: string; label?: string; style: 'serving' | 'flow' | 'access' }>,
): PlantUmlParseResult {
  const warnings: string[] = []
  const nodesByPackage = new Map<string | null, ParsedPlantNode[]>()

  for (const node of parsedNodes) {
    const bucket = nodesByPackage.get(node.packageId) ?? []
    bucket.push(node)
    nodesByPackage.set(node.packageId, bucket)
  }

  const flowNodes: Node<ArchimateNodeData>[] = []
  const colGap = 240
  const rowGap = 120
  const packageGapX = 80
  let packageCursorX = 40

  for (const pkg of packages) {
    const members = nodesByPackage.get(pkg.id) ?? []
    const maxCols = 3
    const width = Math.max(360, Math.min(770, maxCols * colGap + 80))
    const rows = Math.max(1, Math.ceil(members.length / maxCols))
    const height = Math.max(220, rows * rowGap + 100)

    flowNodes.push({
      id: pkg.id,
      type: 'archimateBoundary',
      position: { x: packageCursorX, y: 120 },
      data: { kind: 'boundary', title: pkg.title },
      style: { width, height },
      zIndex: 0,
    })

    members.forEach((member, index) => {
      const row = Math.floor(index / maxCols)
      const col = index % maxCols
      const elementData = buildElementData(member)
      flowNodes.push({
        id: member.id,
        type: 'archimateElement',
        position: {
          x: 40 + col * colGap,
          y: 60 + row * rowGap,
        },
        data: elementData,
        style: { width: member.kind === 'node' ? 150 : 210 },
        parentNode: pkg.id,
        extent: 'parent',
      })
    })

    packageCursorX += width + packageGapX
  }

  const rootNodes = nodesByPackage.get(null) ?? []
  if (rootNodes.length > 0) {
    warnings.push(`${rootNodes.length} node di luar package akan ditempatkan di canvas root.`)
    rootNodes.forEach((member, index) => {
      const row = Math.floor(index / 4)
      const col = index % 4
      const layer = inferLayer(member.kind, member.label)
      flowNodes.push({
        id: member.id,
        type: 'archimateElement',
        position: { x: 40 + col * colGap, y: 40 + row * rowGap },
        data: buildElementData(member),
        style: { width: 210 },
      })
    })
  }

  const nodeIds = new Set(flowNodes.map((node) => node.id))
  const flowEdges: Edge[] = []
  edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      warnings.push(`Koneksi diabaikan: ${edge.source} -> ${edge.target}`)
      return
    }

    const dashed = edge.style !== 'serving'
    flowEdges.push({
      id: `plantuml-edge-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.label,
      labelStyle: { fill: edge.style === 'serving' ? '#334155' : '#475569', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
      labelBgPadding: [4, 2],
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.style === 'serving' ? '#0f172a' : '#475569',
      },
      style: {
        stroke: edge.style === 'serving' ? '#0f172a' : '#475569',
        strokeWidth: 2,
        strokeDasharray: dashed ? (edge.style === 'access' ? '3 5' : '6 6') : undefined,
      },
    })
  })

  if (flowNodes.length === 0) {
    throw new Error('Tidak ada node PlantUML yang dikenali. Gunakan [Nama] as id atau node "Nama" as id.')
  }

  return {
    nodes: normalizeIntegrationNodesForCanvas(flowNodes),
    edges: flowEdges,
    warnings,
  }
}

export function parsePlantUmlToIntegrationGraph(source: string): PlantUmlParseResult {
  const lines = stripPlantUmlBlock(source)
  const usedIds = new Set<string>()
  const parsedNodes: ParsedPlantNode[] = []
  const packages: ParsedPackage[] = []
  const edges: Array<{ source: string; target: string; label?: string; style: 'serving' | 'flow' | 'access' }> = []
  const packageStack: string[] = []
  const warnings: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+\{$/, '').trim()
    if (/^(skinparam|title|note|legend|left to right|top to bottom)/i.test(line)) continue

    const packageStart = line.match(/^package\s+"([^"]+)"(?:\s+\{)?$/i)
    if (packageStart) {
      const title = packageStart[1].trim()
      const id = uniqueId(slugifyId(title), usedIds)
      packages.push({ id, title })
      packageStack.push(id)
      continue
    }

    if (line === '}') {
      packageStack.pop()
      continue
    }

    const edge = parseEdgeLine(line)
    if (edge) {
      edges.push(edge)
      continue
    }

    const currentPackage = packageStack.length > 0 ? packageStack[packageStack.length - 1] : null
    const parsedNode = parseNodeLine(line, currentPackage, usedIds)
    if (parsedNode) {
      parsedNodes.push(parsedNode)
      continue
    }

    if (!/^end\s+note/i.test(line)) {
      warnings.push(`Baris tidak dikenali: ${line}`)
    }
  }

  const layout = layoutIntegrationGraph(parsedNodes, packages, edges)
  return {
    ...layout,
    warnings: [...warnings, ...layout.warnings],
  }
}

export function integrationGraphToPlantUml(nodes: Node<ArchimateNodeData>[], edges: Edge[]): string {
  const lines: string[] = ['@startuml', 'skinparam componentStyle rectangle', '']

  const boundaries = nodes.filter((node) => node.type === 'archimateBoundary')
  const elements = nodes.filter((node) => node.type === 'archimateElement')

  for (const boundary of boundaries) {
    if (boundary.data.kind !== 'boundary') continue
    lines.push(`package "${boundary.data.title}" {`)
    const children = elements.filter((node) => node.parentNode === boundary.id)
    for (const child of children) {
      if (child.data.kind !== 'element') continue
      const alias = slugifyId(child.id)
      if (child.data.layer === 'technology') {
        lines.push(`  node "${child.data.title}" as ${alias}`)
      } else {
        lines.push(`  [${child.data.title}] as ${alias}`)
      }
    }
    lines.push('}', '')
  }

  const rootElements = elements.filter((node) => !node.parentNode)
  for (const child of rootElements) {
    if (child.data.kind !== 'element') continue
    lines.push(`[${child.data.title}] as ${slugifyId(child.id)}`)
  }

  if (edges.length > 0) lines.push('')
  edges.forEach((edge) => {
    const label = typeof edge.label === 'string' && edge.label.trim() ? ` : ${edge.label.trim()}` : ''
    const dashed =
      edge.style && typeof edge.style === 'object' && 'strokeDasharray' in edge.style && edge.style.strokeDasharray
    lines.push(`${edge.source} ${dashed ? '..>' : '-->'} ${edge.target}${label}`)
  })

  lines.push('@enduml')
  return lines.join('\n')
}
