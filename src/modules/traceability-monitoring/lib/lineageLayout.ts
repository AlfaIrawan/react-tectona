import type { Node as FlowNode } from 'reactflow'
import type { LineageEdgeApi, LineageNodeApi } from '@/lib/api/traceabilityMonitoringApi'

export type LineageEntityType = 'idea' | 'project' | 'work_item' | 'document' | 'approval' | 'workspace' | string

export interface LineageEntityStyle {
  label: string
  accent: string
  chipBg: string
  chipText: string
}

export const LINEAGE_ENTITY_STYLES: Record<string, LineageEntityStyle> = {
  idea: { label: 'Idea', accent: '#0ea5e9', chipBg: '#e0f2fe', chipText: '#0369a1' },
  project: { label: 'Project', accent: '#6366f1', chipBg: '#e0e7ff', chipText: '#4338ca' },
  work_item: { label: 'Work Item', accent: '#f59e0b', chipBg: '#fef3c7', chipText: '#b45309' },
  document: { label: 'Document', accent: '#10b981', chipBg: '#d1fae5', chipText: '#047857' },
  approval: { label: 'Approval', accent: '#ef4444', chipBg: '#fee2e2', chipText: '#b91c1c' },
  workspace: { label: 'Workspace', accent: '#64748b', chipBg: '#e2e8f0', chipText: '#334155' },
}

export const DEFAULT_LINEAGE_ENTITY_STYLE: LineageEntityStyle = {
  label: 'Entity',
  accent: '#94a3b8',
  chipBg: '#f1f5f9',
  chipText: '#475569',
}

export function lineageEntityStyle(entityType: string): LineageEntityStyle {
  return LINEAGE_ENTITY_STYLES[entityType] ?? DEFAULT_LINEAGE_ENTITY_STYLE
}

export interface LineageFlowNodeData {
  label: string
  entityType: string
  raw: Record<string, unknown>
}

const COLUMN_WIDTH = 260
const ROW_HEIGHT = 120

/**
 * Layered layout: BFS distance from the root entity determines the column;
 * nodes sharing a distance are stacked vertically within that column. The
 * backend graph endpoint returns no positions, so this runs client-side.
 */
export function layoutLineageGraph(
  nodes: LineageNodeApi[],
  edges: LineageEdgeApi[],
  rootId: string,
): FlowNode<LineageFlowNodeData>[] {
  const adjacency = new Map<string, string[]>()
  for (const node of nodes) adjacency.set(node.id, [])
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    adjacency.get(edge.target)?.push(edge.source)
  }

  const distance = new Map<string, number>()
  if (adjacency.has(rootId)) {
    distance.set(rootId, 0)
    const queue: string[] = [rootId]
    while (queue.length > 0) {
      const current = queue.shift() as string
      const currentDistance = distance.get(current) ?? 0
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!distance.has(neighbor)) {
          distance.set(neighbor, currentDistance + 1)
          queue.push(neighbor)
        }
      }
    }
  }

  const columns = new Map<number, string[]>()
  for (const node of nodes) {
    const column = distance.get(node.id) ?? 0
    const bucket = columns.get(column) ?? []
    bucket.push(node.id)
    columns.set(column, bucket)
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const [column, ids] of columns.entries()) {
    const offsetY = -((ids.length - 1) * ROW_HEIGHT) / 2
    ids.forEach((id, index) => {
      positions.set(id, { x: column * COLUMN_WIDTH, y: offsetY + index * ROW_HEIGHT })
    })
  }

  return nodes.map((node) => ({
    id: node.id,
    type: 'lineageEntity',
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: { label: node.label, entityType: node.type, raw: node.data },
  }))
}
