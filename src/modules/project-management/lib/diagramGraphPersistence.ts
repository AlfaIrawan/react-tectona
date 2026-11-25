import type { Edge, Node } from 'reactflow'

/** An intentionally empty document is a saved graph too, not a missing cache entry. */
export function isStoredDiagramGraph(value: unknown): value is { nodes: Node[]; edges: Edge[]; source?: string } {
  if (!value || typeof value !== 'object') return false
  const graph = value as { nodes?: unknown; edges?: unknown }
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges)
    && graph.nodes.every(node => node && typeof node.id === 'string' && node.position
      && Number.isFinite(node.position.x) && Number.isFinite(node.position.y))
    && graph.edges.every(edge => edge && typeof edge.id === 'string'
      && typeof edge.source === 'string' && typeof edge.target === 'string')
}
