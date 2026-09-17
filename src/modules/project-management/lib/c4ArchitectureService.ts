import type { Edge, Node } from 'reactflow'
import type {
  AnalyzeIdeaC4ArchitectureResponse,
  C4ArchitectureElement,
  C4ArchitectureLevel,
} from '@/lib/api/tectonaAgentRuntimeApi'
import type { IdeaC4ArchitecturePersistent } from '@/lib/api/ideaBacklogApi'
import { isCanvasViewport, readOptionalBoolean, type CanvasViewport } from '@/modules/project-management/lib/integrationGraphStorage'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

export type C4CanvasGraph = {
  nodes: Node<ArchimateNodeData>[]
  edges: Edge[]
  viewport?: CanvasViewport
  userCustomized?: boolean
  source?: string
  snapToGrid?: boolean
}

export type RuntimeC4Analysis = {
  status: 'ok' | 'insufficient_data'
  level: C4ArchitectureLevel
  summaryTitle: string
  executiveBrief: string
  plantumlSource: string
  elements: C4ArchitectureElement[]
  missingEvidence: string[]
  warnings: string[]
  confidenceScore: number
  correlationId: string
  canvasGraph?: C4CanvasGraph
}

export function emptyRuntimeC4Analysis(level: C4ArchitectureLevel): RuntimeC4Analysis {
  return {
    status: 'insufficient_data',
    level,
    summaryTitle: level === 'L1' ? 'C4 Level 1 not generated yet' : 'C4 Level 2 not generated yet',
    executiveBrief: 'Run AI C4 architecture analysis to produce a diagram from idea evidence and KB.',
    plantumlSource: '',
    elements: [],
    missingEvidence: [],
    warnings: [],
    confidenceScore: 0,
    correlationId: '',
  }
}

export function runtimeC4FromAgentResponse(response: AnalyzeIdeaC4ArchitectureResponse): RuntimeC4Analysis {
  return {
    status: response.status,
    level: response.level,
    summaryTitle: response.summary_title,
    executiveBrief: response.executive_brief,
    plantumlSource: response.plantuml_source || '',
    elements: response.elements ?? [],
    missingEvidence: response.missing_evidence ?? [],
    warnings: response.warnings ?? [],
    confidenceScore: response.confidence_score ?? 0,
    correlationId: response.correlation_id ?? '',
  }
}

function canvasGraphFromJson(json: Record<string, unknown>, plantumlSource: string): C4CanvasGraph | undefined {
  const nodes = Array.isArray(json.nodes) ? (json.nodes as Node<ArchimateNodeData>[]) : []
  if (!nodes.length) return undefined
  return {
    nodes,
    edges: Array.isArray(json.edges) ? (json.edges as Edge[]) : [],
    viewport: isCanvasViewport(json.viewport) ? json.viewport : undefined,
    userCustomized: Boolean(json.user_customized),
    snapToGrid: readOptionalBoolean(json.snap_to_grid),
    source: plantumlSource,
  }
}

export function runtimeC4FromPersistent(persistent: IdeaC4ArchitecturePersistent): RuntimeC4Analysis {
  const json = persistent.c4_json
  const plantumlSource = typeof json.plantuml_source === 'string' ? json.plantuml_source : ''
  return {
    status: persistent.status === 'ok' || json.status === 'ok' ? 'ok' : 'insufficient_data',
    level: persistent.level,
    summaryTitle: typeof json.summary_title === 'string' ? json.summary_title : '',
    executiveBrief: typeof json.executive_brief === 'string' ? json.executive_brief : '',
    plantumlSource,
    elements: Array.isArray(json.elements) ? (json.elements as C4ArchitectureElement[]) : [],
    missingEvidence: Array.isArray(json.missing_evidence)
      ? json.missing_evidence.filter((item): item is string => typeof item === 'string')
      : [],
    warnings: Array.isArray(json.warnings)
      ? json.warnings.filter((item): item is string => typeof item === 'string')
      : [],
    confidenceScore: persistent.confidence_score ?? 0,
    correlationId: persistent.source_correlation_id ?? '',
    canvasGraph: canvasGraphFromJson(json, plantumlSource),
  }
}

export function buildPersistentC4Payload(
  analysis: RuntimeC4Analysis,
  generatedBy: string,
): {
  c4_json: Record<string, unknown>
  status: 'ok' | 'insufficient_data' | 'draft'
  confidence_score: number
  generated_by: string
  source_correlation_id?: string | null
} {
  const graph = analysis.canvasGraph
  return {
    c4_json: {
      status: analysis.status,
      summary_title: analysis.summaryTitle,
      executive_brief: analysis.executiveBrief,
      plantuml_source: graph?.source || analysis.plantumlSource,
      elements: analysis.elements,
      missing_evidence: analysis.missingEvidence,
      warnings: analysis.warnings,
      nodes: graph?.nodes ?? [],
      edges: graph?.edges ?? [],
      viewport: graph?.viewport,
      user_customized: Boolean(graph?.userCustomized),
      snap_to_grid: graph?.snapToGrid ?? true,
    },
    status: analysis.status,
    confidence_score: analysis.confidenceScore,
    generated_by: generatedBy,
    source_correlation_id: analysis.correlationId || null,
  }
}
