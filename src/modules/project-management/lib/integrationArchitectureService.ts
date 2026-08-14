import type { AnalyzeIdeaIntegrationResponse } from '@/lib/api/tectonaAgentRuntimeApi'
import type { IdeaIntegrationPersistent } from '@/lib/api/ideaBacklogApi'
import { normalizeIntegrationNodesForCanvas } from '@/modules/project-management/lib/integrationArchitectureDefaults'
import { DEFAULT_INTEGRATION_PLANTUML } from '@/modules/project-management/lib/integrationPlantUmlDefaults'
import type { IntegrationGraphRecord } from '@/modules/project-management/lib/integrationGraphStorage'
import { parsePlantUmlToIntegrationGraph } from '@/modules/project-management/lib/parsePlantUmlToIntegrationGraph'
import type { Edge, Node } from 'reactflow'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

export type RuntimeIntegrationAnalysis = {
  status: 'ok' | 'insufficient_data'
  summaryTitle: string
  executiveBrief: string
  plantumlSource: string
  integrationPatterns: string[]
  recommendedSystems: AnalyzeIdeaIntegrationResponse['recommended_systems']
  missingEvidence: string[]
  warnings: string[]
  confidenceScore: number
  correlationId: string
}

export const EMPTY_RUNTIME_INTEGRATION_ANALYSIS: RuntimeIntegrationAnalysis = {
  status: 'insufficient_data',
  summaryTitle: 'Integration recommendation not generated yet',
  executiveBrief: 'Run AI integration analysis to produce architecture recommendations from idea evidence and KB.',
  plantumlSource: DEFAULT_INTEGRATION_PLANTUML,
  integrationPatterns: [],
  recommendedSystems: [],
  missingEvidence: [],
  warnings: [],
  confidenceScore: 0,
  correlationId: '',
}

export function runtimeIntegrationFromAgentResponse(
  response: AnalyzeIdeaIntegrationResponse,
): RuntimeIntegrationAnalysis {
  return {
    status: response.status,
    summaryTitle: response.summary_title,
    executiveBrief: response.executive_brief,
    plantumlSource: response.plantuml_source || DEFAULT_INTEGRATION_PLANTUML,
    integrationPatterns: response.integration_patterns ?? [],
    recommendedSystems: response.recommended_systems ?? [],
    missingEvidence: response.missing_evidence ?? [],
    warnings: response.warnings ?? [],
    confidenceScore: response.confidence_score ?? 0,
    correlationId: response.correlation_id ?? '',
  }
}

export function graphRecordFromIntegrationAnalysis(
  analysis: RuntimeIntegrationAnalysis,
  options: { userCustomized?: boolean } = {},
): IntegrationGraphRecord {
  let nodes: Node<ArchimateNodeData>[] = []
  let edges: Edge[] = []

  if (analysis.plantumlSource.trim()) {
    try {
      const parsed = parsePlantUmlToIntegrationGraph(analysis.plantumlSource)
      nodes = parsed.nodes
      edges = parsed.edges
    } catch {
      // Fallback handled by caller if needed.
    }
  }

  return {
    nodes: normalizeIntegrationNodesForCanvas(nodes),
    edges,
    plantumlSource: analysis.plantumlSource,
    userCustomized: options.userCustomized ?? false,
    savedAt: new Date().toISOString(),
  }
}

export function graphRecordFromPersistentIntegration(
  persistent: IdeaIntegrationPersistent,
): IntegrationGraphRecord | null {
  const json = persistent.integration_json
  const nodes = Array.isArray(json.nodes) ? (json.nodes as Node<ArchimateNodeData>[]) : null
  const edges = Array.isArray(json.edges) ? (json.edges as Edge[]) : null
  const plantumlSource =
    typeof json.plantuml_source === 'string' && json.plantuml_source.trim()
      ? json.plantuml_source
      : DEFAULT_INTEGRATION_PLANTUML

  if (nodes?.length) {
    return {
      nodes: normalizeIntegrationNodesForCanvas(nodes),
      edges: edges ?? [],
      plantumlSource,
      userCustomized: Boolean(json.user_customized),
      savedAt: persistent.generated_at,
    }
  }

  if (plantumlSource.trim()) {
    try {
      const parsed = parsePlantUmlToIntegrationGraph(plantumlSource)
      return {
        nodes: parsed.nodes,
        edges: parsed.edges,
        plantumlSource,
        userCustomized: Boolean(json.user_customized),
        savedAt: persistent.generated_at,
      }
    } catch {
      return null
    }
  }

  return null
}

export function buildPersistentIntegrationPayload(
  analysis: RuntimeIntegrationAnalysis,
  graph: IntegrationGraphRecord,
  generatedBy: string,
): {
  integration_json: Record<string, unknown>
  status: 'ok' | 'insufficient_data' | 'draft'
  confidence_score: number
  generated_by: string
  source_correlation_id?: string | null
} {
  return {
    integration_json: {
      status: analysis.status,
      summary_title: analysis.summaryTitle,
      executive_brief: analysis.executiveBrief,
      plantuml_source: graph.plantumlSource,
      integration_patterns: analysis.integrationPatterns,
      recommended_systems: analysis.recommendedSystems,
      missing_evidence: analysis.missingEvidence,
      warnings: analysis.warnings,
      nodes: graph.nodes,
      edges: graph.edges,
      user_customized: graph.userCustomized,
    },
    status: analysis.status,
    confidence_score: analysis.confidenceScore,
    generated_by: generatedBy,
    source_correlation_id: analysis.correlationId || null,
  }
}

export function runtimeIntegrationFromPersistent(
  persistent: IdeaIntegrationPersistent,
): RuntimeIntegrationAnalysis {
  const json = persistent.integration_json
  return {
    status:
      persistent.status === 'ok' || json.status === 'ok'
        ? 'ok'
        : 'insufficient_data',
    summaryTitle: typeof json.summary_title === 'string' ? json.summary_title : '',
    executiveBrief: typeof json.executive_brief === 'string' ? json.executive_brief : '',
    plantumlSource:
      typeof json.plantuml_source === 'string' && json.plantuml_source.trim()
        ? json.plantuml_source
        : DEFAULT_INTEGRATION_PLANTUML,
    integrationPatterns: Array.isArray(json.integration_patterns)
      ? json.integration_patterns.filter((item): item is string => typeof item === 'string')
      : [],
    recommendedSystems: Array.isArray(json.recommended_systems)
      ? (json.recommended_systems as RuntimeIntegrationAnalysis['recommendedSystems'])
      : [],
    missingEvidence: Array.isArray(json.missing_evidence)
      ? json.missing_evidence.filter((item): item is string => typeof item === 'string')
      : [],
    warnings: Array.isArray(json.warnings)
      ? json.warnings.filter((item): item is string => typeof item === 'string')
      : [],
    confidenceScore: persistent.confidence_score ?? 0,
    correlationId: persistent.source_correlation_id ?? '',
  }
}
