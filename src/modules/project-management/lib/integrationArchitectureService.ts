import type { AnalyzeIdeaIntegrationResponse } from '@/lib/api/tectonaAgentRuntimeApi'
import type { IdeaIntegrationPersistent } from '@/lib/api/ideaBacklogApi'
import { normalizeIntegrationNodesForCanvas } from '@/modules/project-management/lib/integrationArchitectureDefaults'
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
  // Deliberately empty, NOT a fallback sample diagram — a populated-looking diagram here would be
  // indistinguishable from a real AI result and mask genuine `insufficient_data` outcomes (this
  // masking was the root cause of a real bug: the static example diagram in
  // `integrationPlantUmlDefaults.ts` was rendering as if it were a real AI-generated result).
  plantumlSource: '',
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
    // Empty when the LLM returned `insufficient_data` (plantuml_source is only populated on
    // success) — never substitute the static sample diagram here, see EMPTY_RUNTIME_INTEGRATION_ANALYSIS.
    plantumlSource: response.plantuml_source || '',
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
): IntegrationGraphRecord {
  const json = persistent.integration_json
  const nodes = Array.isArray(json.nodes) ? (json.nodes as Node<ArchimateNodeData>[]) : null
  const edges = Array.isArray(json.edges) ? (json.edges as Edge[]) : null
  // Empty (not the static sample diagram) when nothing was actually persisted — see
  // EMPTY_RUNTIME_INTEGRATION_ANALYSIS for why substituting a fallback here would be misleading.
  const plantumlSource = typeof json.plantuml_source === 'string' ? json.plantuml_source : ''
  const userCustomized = Boolean(json.user_customized)

  if (nodes?.length) {
    return {
      nodes: normalizeIntegrationNodesForCanvas(nodes),
      edges: edges ?? [],
      plantumlSource,
      userCustomized,
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
        userCustomized,
        savedAt: persistent.generated_at,
      }
    } catch {
      // Falls through to the empty record below — an unparseable source is still a genuine
      // "here's the current state" signal (nothing to show), not "we don't know yet".
    }
  }

  // Never return null: an empty-but-real record is what tells the canvas "the fetch completed,
  // there's genuinely nothing here" — returning null here previously meant the canvas's own
  // stale localStorage/default content just stayed on screen forever, because nothing ever
  // arrived to say otherwise.
  return {
    nodes: [],
    edges: [],
    plantumlSource,
    userCustomized,
    savedAt: persistent.generated_at,
  }
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
    // Empty (not the static sample diagram) when nothing was actually persisted.
    plantumlSource: typeof json.plantuml_source === 'string' ? json.plantuml_source : '',
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
