/**
 * Deterministic SVG fallback when Mermaid.js fails to render.
 * Supports common flowchart TD/LR syntax produced by Tectona assistants.
 */

export type FallbackNodeShape = 'rect' | 'diamond' | 'round'

export type FallbackGraph = {
  direction: 'TD' | 'LR'
  nodes: Array<{ id: string; label: string; shape: FallbackNodeShape }>
  edges: Array<{ source: string; target: string; label?: string }>
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cleanSource(source: string): string {
  return source
    .replace(/^\s*```(?:mermaid)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/i, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    // LLM typo: -->|label|> Next
    .replace(/(\|[^\n|]+)\|>(\s*[A-Za-z])/g, '$1|$2')
    .trim()
}

function unwrapLabel(raw: string): string {
  let text = (raw || '').trim()
  for (let i = 0; i < 4; i += 1) {
    if (
      (text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
      (text.startsWith("'") && text.endsWith("'") && text.length >= 2)
    ) {
      text = text.slice(1, -1).trim()
      continue
    }
    if (text.startsWith('(') && text.endsWith(')') && text.length >= 2) {
      text = text.slice(1, -1).trim()
      continue
    }
    break
  }
  return text
}

function isEventLabel(label: string): boolean {
  return /^(mulai|selesai|start|end)$/i.test(label.trim())
}

function isEventNode(node: { label: string; shape: FallbackNodeShape }): boolean {
  return node.shape === 'round' || isEventLabel(node.label)
}

function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [label]
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 4)
}

/** Parse flowchart / graph bodies into nodes + edges. */
export function parseFlowchartFallback(source: string): FallbackGraph | null {
  const text = cleanSource(source)
  if (!text) return null

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const header = lines.find((line) => /^(flowchart|graph)\s+/i.test(line))
  if (!header && !lines.some((line) => /-->/.test(line))) return null

  const directionMatch = header?.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL)\b/i)
  const directionRaw = (directionMatch?.[1] ?? 'TD').toUpperCase()
  const direction: 'TD' | 'LR' = directionRaw === 'LR' || directionRaw === 'RL' ? 'LR' : 'TD'

  const nodes = new Map<string, { id: string; label: string; shape: FallbackNodeShape }>()
  const edges: FallbackGraph['edges'] = []

  const ensureNode = (id: string, label?: string, shape: FallbackNodeShape = 'rect') => {
    const existing = nodes.get(id)
    if (!existing) {
      nodes.set(id, { id, label: label ?? id, shape })
      return
    }
    if (label && existing.label === id) {
      existing.label = label
      existing.shape = shape
    }
  }

  const nodeDecl =
    /^([A-Za-z][\w-]*)\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(\(([^)]*)\)\)|\(([^)]*)\)|\(\[([^\]]*)\]\)|\[\[([^\]]*)\]\])/

  for (const line of lines) {
    if (/^(flowchart|graph)\s+/i.test(line)) continue
    if (/^(subgraph|end|style|classDef|class|linkStyle|click|direction)\b/i.test(line)) continue

    // A[Label] -->|edge| B{Decision}
    const edgeWithLabel = line.match(
      /^([A-Za-z][\w-]*)(?:\s*(?:\[[^\]]*\]|\{[^}]*\}|\([^)]*\)))?\s*--\s*>?\s*\|([^|]*)\|\s*>?\s*([A-Za-z][\w-]*)(?:\s*(?:\[[^\]]*\]|\{[^}]*\}|\([^)]*\)))?$/,
    )
    if (edgeWithLabel) {
      const sourceId = edgeWithLabel[1]
      const edgeLabel = unwrapLabel(edgeWithLabel[2])
      const targetId = edgeWithLabel[3]
      for (const piece of line.matchAll(
        /([A-Za-z][\w-]*)\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(\(([^)]*)\)\)|\(([^)]*)\))/g,
      )) {
        const id = piece[1]
        const label = unwrapLabel(piece[2] ?? piece[3] ?? piece[4] ?? piece[5] ?? id)
        const shape: FallbackNodeShape =
          piece[3] != null ? 'diamond' : piece[4] != null || piece[5] != null ? 'round' : 'rect'
        ensureNode(id, label, shape)
      }
      ensureNode(sourceId)
      ensureNode(targetId)
      edges.push({ source: sourceId, target: targetId, label: edgeLabel || undefined })
      continue
    }

    const chainIds =
      /-->|---/.test(line)
        ? line
            .split(/\s*(?:--+>|---+)\s*(?:\|[^|]*\|\s*)?/)
            .map((chunk) => chunk.trim().match(/^([A-Za-z][\w-]*)/)?.[1])
            .filter((id): id is string => Boolean(id))
        : []
    if (chainIds.length >= 2) {
      for (const piece of line.matchAll(
        /([A-Za-z][\w-]*)\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(\(([^)]*)\)\)|\(([^)]*)\))/g,
      )) {
        const id = piece[1]
        const label = unwrapLabel(piece[2] ?? piece[3] ?? piece[4] ?? piece[5] ?? id)
        const shape: FallbackNodeShape =
          piece[3] != null ? 'diamond' : piece[4] != null || piece[5] != null ? 'round' : 'rect'
        ensureNode(id, label, shape)
      }
      for (const id of chainIds) ensureNode(id)
      const labels = [...line.matchAll(/\|([^|]+)\|/g)].map((m) => unwrapLabel(m[1]))
      for (let i = 0; i < chainIds.length - 1; i += 1) {
        edges.push({
          source: chainIds[i],
          target: chainIds[i + 1],
          label: labels[i] || undefined,
        })
      }
      continue
    }

    // A --> B  or A[Label] --> B[Label]
    const plainEdge = line.match(
      /^([A-Za-z][\w-]*)(?:\s*(?:\[[^\]]*\]|\{[^}]*\}|\([^)]*\)))?\s*--+>\s*([A-Za-z][\w-]*)(?:\s*(?:\[[^\]]*\]|\{[^}]*\}|\([^)]*\)))?$/,
    )
    if (plainEdge) {
      const sourceId = plainEdge[1]
      const targetId = plainEdge[2]
      for (const piece of line.matchAll(
        /([A-Za-z][\w-]*)\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(\(([^)]*)\)\)|\(([^)]*)\))/g,
      )) {
        const id = piece[1]
        const label = unwrapLabel(piece[2] ?? piece[3] ?? piece[4] ?? piece[5] ?? id)
        const shape: FallbackNodeShape =
          piece[3] != null ? 'diamond' : piece[4] != null || piece[5] != null ? 'round' : 'rect'
        ensureNode(id, label, shape)
      }
      ensureNode(sourceId)
      ensureNode(targetId)
      edges.push({ source: sourceId, target: targetId })
      continue
    }

    const alone = line.match(nodeDecl)
    if (alone) {
      const id = alone[1]
      const label = unwrapLabel(alone[2] ?? alone[3] ?? alone[4] ?? alone[5] ?? alone[6] ?? alone[7] ?? id)
      const shape: FallbackNodeShape =
        alone[3] != null ? 'diamond' : alone[4] != null || alone[5] != null ? 'round' : 'rect'
      ensureNode(id, label, shape)
    }
  }

  if (nodes.size === 0) return null
  if (edges.length === 0 && nodes.size >= 2) {
    const ids = [...nodes.keys()]
    for (let i = 0; i < ids.length - 1; i += 1) {
      edges.push({ source: ids[i], target: ids[i + 1] })
    }
  }
  collapseBareFallbackNodes(nodes, edges)
  connectOrphanNodes(nodes, edges)
  if (nodes.size === 0) return null
  return { direction, nodes: [...nodes.values()], edges }
}

function connectOrphanNodes(
  nodes: Map<string, { id: string; label: string; shape: FallbackNodeShape }>,
  edges: FallbackGraph['edges'],
) {
  const ids = [...nodes.keys()]
  for (let i = 0; i < ids.length - 1; i += 1) {
    const source = ids[i]
    const target = ids[i + 1]
    const targetHasIncoming = edges.some((edge) => edge.target === target)
    const alreadyLinked = edges.some((edge) => edge.source === source && edge.target === target)
    if (!targetHasIncoming && !alreadyLinked) {
      edges.push({ source, target })
    }
  }
}

function collapseBareFallbackNodes(
  nodes: Map<string, { id: string; label: string; shape: FallbackNodeShape }>,
  edges: FallbackGraph['edges'],
) {
  const isBare = (node: { id: string; label: string }) => node.label === node.id && node.id.length <= 2
  let changed = true
  while (changed) {
    changed = false
    for (const node of [...nodes.values()]) {
      if (!isBare(node)) continue
      const succs = edges.filter((e) => e.source === node.id)
      const preds = edges.filter((e) => e.target === node.id)
      if (succs.length === 0) {
        node.label = 'Selesai'
        continue
      }
      const kept = edges.filter((e) => e.source !== node.id && e.target !== node.id)
      for (const pred of preds) {
        for (const succ of succs) {
          kept.push({ source: pred.source, target: succ.target, label: pred.label || succ.label })
        }
      }
      edges.length = 0
      edges.push(...kept)
      nodes.delete(node.id)
      changed = true
      break
    }
  }
}

/** Rebuild flowchart source without 1–2 character unlabeled boxes (J, l, …). */
export function rewriteBareMermaidSource(source: string): string {
  const graph = parseFlowchartFallback(source)
  if (!graph) return source
  const lines = [`flowchart ${graph.direction}`]
  for (const node of graph.nodes) {
    const label = node.label.replace(/"/g, "'")
    if (node.shape === 'diamond') {
      lines.push(`  ${node.id}{"${label}"}`)
    } else if (node.shape === 'round') {
      lines.push(`  ${node.id}("${label}")`)
    } else {
      lines.push(`  ${node.id}["${label}"]`)
    }
  }
  for (const edge of graph.edges) {
    if (edge.label) {
      lines.push(`  ${edge.source} -->|"${edge.label.replace(/"/g, "'")}"| ${edge.target}`)
    } else {
      lines.push(`  ${edge.source} --> ${edge.target}`)
    }
  }
  return lines.join('\n')
}

function layoutGraph(graph: FallbackGraph): {
  width: number
  height: number
  positions: Map<string, { x: number; y: number; w: number; h: number }>
} {
  const gapX = 56
  const gapY = 52
  const pad = 28
  const boxes = new Map<string, { w: number; h: number }>()
  const eventSize = 44
  let processWidth = 280
  for (const node of graph.nodes) {
    if (isEventNode(node)) continue
    const longest = Math.max(...wrapLabel(node.label, 34).map((line) => line.length), 16)
    processWidth = Math.max(processWidth, Math.min(420, longest * 8 + 40))
  }
  for (const node of graph.nodes) {
    if (isEventNode(node)) {
      boxes.set(node.id, { w: eventSize, h: eventSize })
      continue
    }
    const lines = wrapLabel(node.label, Math.max(18, Math.floor((processWidth - 32) / 7)))
    boxes.set(node.id, { w: processWidth, h: Math.max(72, 28 + lines.length * 18) })
  }

  const indegree = new Map<string, number>()
  const children = new Map<string, string[]>()
  for (const node of graph.nodes) {
    indegree.set(node.id, 0)
    children.set(node.id, [])
  }
  for (const edge of graph.edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    children.get(edge.source)?.push(edge.target)
  }

  const rank = new Map<string, number>()
  const queue = graph.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id)
  if (queue.length === 0 && graph.nodes[0]) queue.push(graph.nodes[0].id)
  for (const id of queue) rank.set(id, 0)

  const visiting = [...queue]
  while (visiting.length > 0) {
    const id = visiting.shift()!
    const base = rank.get(id) ?? 0
    for (const child of children.get(id) ?? []) {
      const next = base + 1
      if ((rank.get(child) ?? -1) < next) {
        rank.set(child, next)
        visiting.push(child)
      }
    }
  }
  for (const node of graph.nodes) {
    if (!rank.has(node.id)) rank.set(node.id, 0)
  }

  const buckets = new Map<number, string[]>()
  for (const node of graph.nodes) {
    const r = rank.get(node.id) ?? 0
    const list = buckets.get(r) ?? []
    list.push(node.id)
    buckets.set(r, list)
  }
  const ranks = [...buckets.keys()].sort((a, b) => a - b)
  const columnWidth = processWidth
  const centerX = pad + columnWidth / 2

  const positions = new Map<string, { x: number; y: number; w: number; h: number }>()
  let maxX = 0
  let maxY = 0

  ranks.forEach((r, rankIndex) => {
    const ids = buckets.get(r) ?? []
    const rankHeights = ids.map((id) => boxes.get(id)?.h ?? 80)
    const rowH = Math.max(...rankHeights, 44)
    ids.forEach((id, colIndex) => {
      const box = boxes.get(id) ?? { w: columnWidth, h: 80 }
      const x =
        graph.direction === 'LR'
          ? pad + rankIndex * (columnWidth + gapX) + (columnWidth - box.w) / 2
          : ids.length === 1
            ? centerX - box.w / 2
            : pad + colIndex * (columnWidth + gapX) + (columnWidth - box.w) / 2
      const y =
        graph.direction === 'LR'
          ? pad + colIndex * (rowH + gapY) + (rowH - box.h) / 2
          : pad + rankIndex * (rowH + gapY) + (rowH - box.h) / 2
      positions.set(id, { x, y, w: box.w, h: box.h })
      maxX = Math.max(maxX, x + box.w)
      maxY = Math.max(maxY, y + box.h)
    })
  })

  return {
    width: Math.max(maxX + pad, 360),
    height: Math.max(maxY + pad, 200),
    positions,
  }
}

/** Build an SVG string for a parsed flowchart. Always returns a drawable diagram when parse succeeds. */
export function buildFlowchartFallbackSvg(source: string): string | null {
  const graph = parseFlowchartFallback(source)
  if (!graph) return null

  const { width, height, positions } = layoutGraph(graph)

  const nodeSvg = graph.nodes
    .map((node) => {
      const pos = positions.get(node.id)
      if (!pos) return ''
      const lines = wrapLabel(node.label, Math.max(18, Math.floor((pos.w - 32) / 7)))
      const text = lines
        .map((line, idx) => {
          const dy = idx === 0 ? -((lines.length - 1) * 7) : 14
          return `<tspan x="${pos.x + pos.w / 2}" dy="${dy}">${escapeXml(line)}</tspan>`
        })
        .join('')

      if (node.shape === 'diamond') {
        const cx = pos.x + pos.w / 2
        const cy = pos.y + pos.h / 2
        const rw = pos.w * 0.46
        const rh = pos.h * 0.46
        const points = `${cx},${cy - rh} ${cx + rw},${cy} ${cx},${cy + rh} ${cx - rw},${cy}`
        return `<g>
  <polygon points="${points}" fill="#ffffff" stroke="#111827" stroke-width="1.6" />
  <text fill="#111827" font-size="12" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" y="${cy}">${text}</text>
</g>`
      }

      if (isEventNode(node)) {
        const cx = pos.x + pos.w / 2
        const cy = pos.y + pos.h / 2
        const radius = Math.max(16, Math.min(pos.w, pos.h) / 2 - 2)
        const strokeWidth = /selesai|^end$/i.test(node.label.trim()) ? 4 : 1.6
        return `<g>
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#ffffff" stroke="#111827" stroke-width="${strokeWidth}" />
  <text fill="#111827" font-size="11" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" y="${cy}">${text}</text>
</g>`
      }

      return `<g>
  <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="12" fill="#ffffff" stroke="#111827" stroke-width="1.6" />
  <text fill="#111827" font-size="12" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" y="${pos.y + pos.h / 2}">${text}</text>
</g>`
    })
    .join('\n')

  const edgeSvg = graph.edges
    .map((edge, index) => {
      const from = positions.get(edge.source)
      const to = positions.get(edge.target)
      if (!from || !to) return ''
      const x1 = graph.direction === 'LR' ? from.x + from.w : from.x + from.w / 2
      const y1 = graph.direction === 'LR' ? from.y + from.h / 2 : from.y + from.h
      const x2 = graph.direction === 'LR' ? to.x : to.x + to.w / 2
      const y2 = graph.direction === 'LR' ? to.y + to.h / 2 : to.y
      const path =
        graph.direction === 'LR'
          ? Math.abs(y1 - y2) < 1
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} L ${(x1 + x2) / 2} ${y1} L ${(x1 + x2) / 2} ${y2} L ${x2} ${y2}`
          : Math.abs(x1 - x2) < 1
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2}`
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const label = edge.label
        ? `<text x="${mx}" y="${my - 6}" fill="#475569" font-size="11" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle">${escapeXml(edge.label)}</text>`
        : ''
      return `<g>
  <path d="${path}" stroke="#111827" stroke-width="1.8" fill="none" marker-end="url(#arrow-${index})" />
  ${label}
  <defs>
    <marker id="arrow-${index}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#111827" />
    </marker>
  </defs>
</g>`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Flowchart diagram">
  <rect width="100%" height="100%" fill="#ffffff" />
  ${edgeSvg}
  ${nodeSvg}
</svg>`
}
