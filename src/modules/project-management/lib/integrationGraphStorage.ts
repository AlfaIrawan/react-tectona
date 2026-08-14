import type { Edge, Node } from 'reactflow'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

export const IDEA_INTEGRATION_GRAPH_STORAGE_KEY_V1 = 'tectona-idea-integration-graph-v1'
export const IDEA_INTEGRATION_GRAPH_STORAGE_KEY = 'tectona-idea-integration-graph-v2'

export type IntegrationGraphRecord = {
  nodes: Node<ArchimateNodeData>[]
  edges: Edge[]
  plantumlSource?: string
  userCustomized: boolean
  savedAt: string
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
  }
}

export function saveIntegrationGraph(ideaId: string, record: IntegrationGraphRecord): void {
  const store = readStore(IDEA_INTEGRATION_GRAPH_STORAGE_KEY)
  store[ideaId] = record
  writeStore(IDEA_INTEGRATION_GRAPH_STORAGE_KEY, store)
}
