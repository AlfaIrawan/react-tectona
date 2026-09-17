import type { Edge, Node } from 'reactflow'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

export const IDEA_INTEGRATION_GRAPH_STORAGE_KEY_V1 = 'tectona-idea-integration-graph-v1'
export const IDEA_INTEGRATION_GRAPH_STORAGE_KEY = 'tectona-idea-integration-graph-v2'

export type CanvasViewport = {
  x: number
  y: number
  zoom: number
}

export type IntegrationGraphRecord = {
  nodes: Node<ArchimateNodeData>[]
  edges: Edge[]
  plantumlSource?: string
  userCustomized: boolean
  savedAt: string
  viewport?: CanvasViewport
  snapToGrid?: boolean
}

export function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function isCanvasViewport(value: unknown): value is CanvasViewport {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.x === 'number'
    && Number.isFinite(candidate.x)
    && typeof candidate.y === 'number'
    && Number.isFinite(candidate.y)
    && typeof candidate.zoom === 'number'
    && Number.isFinite(candidate.zoom)
    && candidate.zoom > 0
  )
}

type IntegrationGraphStore = Record<string, IntegrationGraphRecord>

function readStore(key: string): IntegrationGraphStore {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as IntegrationGraphStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(key: string, store: IntegrationGraphStore): void {
  localStorage.setItem(key, JSON.stringify(store))
}

export function loadIntegrationGraph(ideaId: string): IntegrationGraphRecord | null {
  const current = readStore(IDEA_INTEGRATION_GRAPH_STORAGE_KEY)[ideaId]
  if (current?.nodes?.length) return current

  const legacy = readStore(IDEA_INTEGRATION_GRAPH_STORAGE_KEY_V1)[ideaId]
  if (!legacy?.nodes?.length) return null

  return {
    nodes: legacy.nodes,
    edges: legacy.edges,
    userCustomized: legacy.userCustomized,
    savedAt: legacy.savedAt,
    viewport: isCanvasViewport(legacy.viewport) ? legacy.viewport : undefined,
  }
}

export function saveIntegrationGraph(ideaId: string, record: IntegrationGraphRecord): void {
  const store = readStore(IDEA_INTEGRATION_GRAPH_STORAGE_KEY)
  store[ideaId] = record
  writeStore(IDEA_INTEGRATION_GRAPH_STORAGE_KEY, store)
}
