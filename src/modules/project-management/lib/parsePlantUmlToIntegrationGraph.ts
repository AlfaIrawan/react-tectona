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

  // Bareword declaration with no bracket/keyword at all, e.g. `Natuna as N` or `API Gateway as GW`
  // — valid PlantUML (a plain unlabeled-type element), and something the LLM reaches for often
  // even though the prompt asks for `[Name] as alias`. Without this, a line like this is silently
  // dropped, and if it's the ONLY node syntax in an otherwise-successful AI response, the whole
  // diagram ends up with zero parsed nodes despite the underlying content being genuinely good.
  const barewordMatch = line.match(/^([A-Za-z][A-Za-z0-9_ ]*?)\s+as\s+([A-Za-z0-9_]+)$/i)
  if (barewordMatch) {
    const label = barewordMatch[1].trim()
    const id = uniqueId(barewordMatch[2].trim(), usedIds)
    return { id, label, packageId, kind: 'component' }
  }

  return null
}

// Strips a PlantUML package-qualification prefix from a reference, e.g. `biz.N` -> `N`. The LLM
// sometimes qualifies members by their enclosing package (`biz.N --> biz.DK`) even though the
// prompt's plain-alias examples don't show it — this lets edges still resolve against the bare
// aliases the node parser actually registers, instead of silently failing to match either endpoint.
function stripPackageQualifier(ref: string): string {
  const dotIndex = ref.lastIndexOf('.')
  return dotIndex >= 0 ? ref.slice(dotIndex + 1) : ref
}

function parseEdgeLine(
  line: string,
): { source: string; target: string; label?: string; style: 'serving' | 'flow' | 'access' } | null {
  const edgeMatch = line.match(
    /^([A-Za-z0-9_.]+)\s+(?:-\[(?:\w+)\]->|-->|\.{2,}>|\.\.>>|->|<\.{2,}|\.{2,}<)\s+([A-Za-z0-9_.]+)(?:\s*:\s*(.+))?$/,
  )
  if (!edgeMatch) return null

  const label = edgeMatch[3]?.trim()
  const isDotted = line.includes('..>') || line.includes('..>>') || line.includes('<..')
  let style: 'serving' | 'flow' | 'access' = isDotted ? 'flow' : 'serving'
  if (label?.toLowerCase() === 'access') style = 'access'
  if (label?.toLowerCase() === 'flow') style = 'flow'
  if (label?.toLowerCase() === 'serving') style = 'serving'

  return {
    source: stripPackageQualifier(edgeMatch[1]),
    target: stripPackageQualifier(edgeMatch[2]),
    label: label || undefined,
    style,
  }
}

// Orders node ids by how early they appear in the edge flow (sources before targets, via a
// Kahn's-algorithm topological sort) rather than raw declaration order. Declaration order often
// doesn't match connection order — the LLM tends to list elements as a group and edges
// separately — so laying members out in DECLARATION order regularly puts connected nodes on
// opposite corners of the grid, forcing edges to route across/behind unrelated boxes instead of
// flowing cleanly left-to-right. Falls back to declaration order for any node a cycle prevents
// from being ordered (rare, but must never drop a node).
function computeFlowOrder(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
): Map<string, number> {
  const order = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const id of nodeIds) {
    adjacency.set(id, [])
    inDegree.set(id, 0)
  }
  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !inDegree.has(edge.target)) continue
    adjacency.get(edge.source)!.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const queue = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0)
  const visited = new Set<string>()
  let index = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    order.set(id, index++)
    for (const next of adjacency.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1)
      if ((inDegree.get(next) ?? 0) <= 0 && !visited.has(next)) queue.push(next)
    }
  }
  // Cycle-involved nodes never reach in-degree 0 — keep them in their original relative order,
  // appended after everything the topological pass could place.
  for (const id of nodeIds) {
    if (!order.has(id)) order.set(id, index++)
  }
  return order
}

// Default footprint used for center-point math when a node's real rendered height isn't known
// (elements don't carry an explicit height in `style`, only width) — only the ratio between
// this and colGap/rowGap matters for picking a side, not pixel accuracy.
const DEFAULT_ELEMENT_HEIGHT = 90

type NodeGeometry = { x: number; y: number; width: number; height: number }

// Each node exposes a full ring of named handles (source-left/top/right/bottom and their target
// counterparts, see `integrationArchimateNodeTypes.tsx`), but an edge with no explicit
// sourceHandle/targetHandle can't pick among same-type siblings and effectively always resolves
// to whichever is declared first (Left) — regardless of where the other node actually sits. This
// picks the handle pair facing each other based on the nodes' laid-out positions at parse time (a
// "floating edge" side heuristic). Recomputing this live on every drag would need a custom edge
// type that bypasses React Flow's own handle-resolution step, which turned out to silently drop
// edges in this app's React Flow version when no single concrete handle could be resolved up
// front — so the side is fixed at layout time here and refreshed on drag-stop instead, see
// `handleNodeDragStop` in EditableIntegrationArchitectureCanvas.tsx.
//
// The axis choice is bounding-box overlap, not raw dx/dy magnitude: the grid layout wraps a
// package's members onto a new row every `maxCols` items, so a source in the last column of one
// row often connects to a target in the first column of the next — a case where |dx| (several
// columns) dwarfs |dy| (one row), yet routing left/right there drags the edge back across every
// sibling node still sitting in the source's own row. Whenever the two nodes' vertical ranges
// don't overlap (different rows) we route top/bottom through the row gutter instead, which is
// normally clear of other nodes/edges; left/right is reserved for genuine same-row neighbors.
export function pickHandleSides(from: NodeGeometry, to: NodeGeometry): { sourceHandle: string; targetHandle: string } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2)
  const dy = to.y + to.height / 2 - (from.y + from.height / 2)
  const rowsOverlap = from.y < to.y + to.height && to.y < from.y + from.height
  const columnsOverlap = from.x < to.x + to.width && to.x < from.x + from.width

  if (rowsOverlap && !columnsOverlap) {
    return dx >= 0
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : { sourceHandle: 'source-left', targetHandle: 'target-right' }
  }
  return dy >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
}

function layoutIntegrationGraph(
  parsedNodes: ParsedPlantNode[],
  packages: ParsedPackage[],
  edges: Array<{ source: string; target: string; label?: string; style: 'serving' | 'flow' | 'access' }>,
): PlantUmlParseResult {
  const warnings: string[] = []
  const nodesByPackage = new Map<string | null, ParsedPlantNode[]>()
  const flowOrder = computeFlowOrder(parsedNodes.map((node) => node.id), edges)
  // Absolute (canvas-space) geometry per node, used only to pick edge handle sides below —
  // `position` on package members is parent-relative in React Flow, so this adds each member's
  // package origin back in to get a comparable, absolute center point for every node.
  const nodeGeometry = new Map<string, NodeGeometry>()

  for (const node of parsedNodes) {
    const bucket = nodesByPackage.get(node.packageId) ?? []
    bucket.push(node)
    nodesByPackage.set(node.packageId, bucket)
  }
  for (const bucket of nodesByPackage.values()) {
    bucket.sort((a, b) => (flowOrder.get(a.id) ?? 0) - (flowOrder.get(b.id) ?? 0))
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
    const pkgOriginX = packageCursorX
    const pkgOriginY = 120

    flowNodes.push({
      id: pkg.id,
      type: 'archimateBoundary',
      position: { x: pkgOriginX, y: pkgOriginY },
      data: { kind: 'boundary', title: pkg.title },
      style: { width, height },
      zIndex: 0,
    })
    nodeGeometry.set(pkg.id, { x: pkgOriginX, y: pkgOriginY, width, height })

    members.forEach((member, index) => {
      const row = Math.floor(index / maxCols)
      const col = index % maxCols
      const elementData = buildElementData(member)
      const localX = 40 + col * colGap
      const localY = 60 + row * rowGap
      const elementWidth = member.kind === 'node' ? 150 : 210
      flowNodes.push({
        id: member.id,
        type: 'archimateElement',
        position: { x: localX, y: localY },
        data: elementData,
        style: { width: elementWidth },
        parentNode: pkg.id,
      })
      nodeGeometry.set(member.id, {
        x: pkgOriginX + localX,
        y: pkgOriginY + localY,
        width: elementWidth,
        height: DEFAULT_ELEMENT_HEIGHT,
      })
    })

    packageCursorX += width + packageGapX
  }

  const rootNodes = nodesByPackage.get(null) ?? []
  if (rootNodes.length > 0) {
    warnings.push(`${rootNodes.length} node(s) outside any package will be placed on the canvas root.`)
    rootNodes.forEach((member, index) => {
      const row = Math.floor(index / 4)
      const col = index % 4
      const layer = inferLayer(member.kind, member.label)
      const x = 40 + col * colGap
      const y = 40 + row * rowGap
      flowNodes.push({
        id: member.id,
        type: 'archimateElement',
        position: { x, y },
        data: buildElementData(member),
        style: { width: 210 },
      })
      nodeGeometry.set(member.id, { x, y, width: 210, height: DEFAULT_ELEMENT_HEIGHT })
    })
  }

  const nodeIds = new Set(flowNodes.map((node) => node.id))
  const flowEdges: Edge[] = []
  edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      warnings.push(`Connection ignored: ${edge.source} -> ${edge.target}`)
      return
    }

    const dashed = edge.style !== 'serving'
    const sourceGeometry = nodeGeometry.get(edge.source)
    const targetGeometry = nodeGeometry.get(edge.target)
    const handles =
      sourceGeometry && targetGeometry ? pickHandleSides(sourceGeometry, targetGeometry) : undefined
    flowEdges.push({
      id: `plantuml-edge-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: handles?.sourceHandle,
      targetHandle: handles?.targetHandle,
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
    throw new Error('No PlantUML nodes were recognized. Use [Name] as id or node "Name" as id.')
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

    // The optional `as <alias>` lets the package itself be dot-referenced later (`biz.N`), a style
    // the LLM reaches for even though the prompt's examples don't show it — without tolerating it
    // here, the package line itself goes unrecognized and every member inside it silently falls
    // back to "no package" (its own separate, now-fixed problem — see `stripPackageQualifier`).
    const packageStart = line.match(/^package\s+"([^"]+)"(?:\s+as\s+[A-Za-z0-9_]+)?(?:\s+\{)?$/i)
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
      warnings.push(`Unrecognized line: ${line}`)
    }
  }

  const resolvedEdges = resolveEdgeEndpointsCaseInsensitively(parsedNodes, edges)
  const layout = layoutIntegrationGraph(parsedNodes, packages, resolvedEdges)
  return {
    ...layout,
    warnings: [...warnings, ...layout.warnings],
  }
}

// The LLM is asked to reference nodes by their declared alias (`[Natuna] as n`), but edge lines
// sometimes capitalize the reference (`N --> DK`) while the declaration itself stayed lowercase
// (`as n`) — plain PlantUML aliases are case-sensitive, so without this every edge in an otherwise
// perfectly good diagram would fail its `nodeIds.has(...)` check and get silently dropped as
// "Connection ignored", leaving a diagram with all its nodes but none of its relationships. This
// remaps each edge endpoint to whichever declared alias matches it case-insensitively.
function resolveEdgeEndpointsCaseInsensitively(
  parsedNodes: ParsedPlantNode[],
  edges: Array<{ source: string; target: string; label?: string; style: 'serving' | 'flow' | 'access' }>,
): Array<{ source: string; target: string; label?: string; style: 'serving' | 'flow' | 'access' }> {
  const idByLowerCase = new Map<string, string>()
  for (const node of parsedNodes) {
    if (!idByLowerCase.has(node.id.toLowerCase())) idByLowerCase.set(node.id.toLowerCase(), node.id)
  }
  return edges.map((edge) => ({
    ...edge,
    source: idByLowerCase.get(edge.source.toLowerCase()) ?? edge.source,
    target: idByLowerCase.get(edge.target.toLowerCase()) ?? edge.target,
  }))
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
