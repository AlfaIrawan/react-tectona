import type { AnalyzeIdeaProcessResponse, ProcessSubTask } from '@/lib/api/tectonaAgentRuntimeApi'
import type { IdeaProcessDiagramPersistent } from '@/lib/api/ideaBacklogApi'

export type RuntimeProcessDiagramAnalysis = {
  status: 'ok' | 'insufficient_data'
  summaryTitle: string
  executiveBrief: string
  bpmnXml: string
  renderedPngBase64: string | null
  subProcesses: ProcessSubTask[]
  missingEvidence: string[]
  warnings: string[]
  confidenceScore: number
  correlationId: string
}

export function emptyRuntimeProcessDiagramAnalysis(): RuntimeProcessDiagramAnalysis {
  return {
    status: 'insufficient_data',
    summaryTitle: 'Business process diagram not generated yet',
    executiveBrief: 'Run AI process analysis to produce a BPMN diagram from idea evidence.',
    bpmnXml: '',
    renderedPngBase64: null,
    subProcesses: [],
    missingEvidence: [],
    warnings: [],
    confidenceScore: 0,
    correlationId: '',
  }
}

export function runtimeProcessDiagramFromAgentResponse(
  response: AnalyzeIdeaProcessResponse,
): RuntimeProcessDiagramAnalysis {
  return {
    status: response.status,
    summaryTitle: response.summary_title,
    executiveBrief: response.executive_brief,
    bpmnXml: response.bpmn_xml || '',
    renderedPngBase64: response.rendered_png_base64 ?? null,
    subProcesses: response.sub_processes ?? [],
    missingEvidence: response.missing_evidence ?? [],
    warnings: response.warnings ?? [],
    confidenceScore: response.confidence_score ?? 0,
    correlationId: response.correlation_id ?? '',
  }
}

export function runtimeProcessDiagramFromPersistent(
  persistent: IdeaProcessDiagramPersistent,
): RuntimeProcessDiagramAnalysis {
  const json = persistent.process_json
  return {
    status: persistent.status === 'ok' || json.status === 'ok' ? 'ok' : 'insufficient_data',
    summaryTitle: typeof json.summary_title === 'string' ? json.summary_title : '',
    executiveBrief: typeof json.executive_brief === 'string' ? json.executive_brief : '',
    bpmnXml: typeof json.bpmn_xml === 'string' ? json.bpmn_xml : '',
    renderedPngBase64: typeof json.rendered_png_base64 === 'string' ? json.rendered_png_base64 : null,
    subProcesses: Array.isArray(json.sub_processes) ? (json.sub_processes as ProcessSubTask[]) : [],
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

export function buildPersistentProcessDiagramPayload(
  analysis: RuntimeProcessDiagramAnalysis,
  generatedBy: string,
): {
  process_json: Record<string, unknown>
  status: 'ok' | 'insufficient_data' | 'draft'
  confidence_score: number
  generated_by: string
  source_correlation_id?: string | null
} {
  return {
    process_json: {
      status: analysis.status,
      summary_title: analysis.summaryTitle,
      executive_brief: analysis.executiveBrief,
      bpmn_xml: analysis.bpmnXml,
      rendered_png_base64: analysis.renderedPngBase64,
      sub_processes: analysis.subProcesses,
      missing_evidence: analysis.missingEvidence,
      warnings: analysis.warnings,
    },
    status: analysis.status,
    confidence_score: analysis.confidenceScore,
    generated_by: generatedBy,
    source_correlation_id: analysis.correlationId || null,
  }
}
