export type ScenarioSuitabilityLevel = 'high' | 'partial' | 'low'

export type ScenarioAnalysisVerdict = 'sufficient' | 'insufficient'

export type ScenarioPriority = 'P1' | 'P2' | 'P3'

export type ScenarioCatalogStatus = 'draft' | 'reviewed' | 'ready'

export type ScenarioSourceType = 'ai_generated' | 'manual' | 'uploaded_document' | 'template_generated'

export type ScenarioExecutionStatus = 'not_run' | 'passed' | 'failed' | 'blocked' | 'skipped'

export type ScenarioExecution = {
  status: ScenarioExecutionStatus
  actual_result?: string
  executed_by?: string
  executed_at?: string
  evidence_urls?: string[]
}

export type ScenarioTraceabilityRef = {
  document_id: string
  document_title?: string | null
  reference: string
}

export type ScenarioSourceDocumentAnalysis = {
  document_id: string
  document_title: string
  document_type_code: string
  suitability: ScenarioSuitabilityLevel
  suitability_score: number
  role: string
  evidence_quote: string
  rationale: string
}

export type ScenarioGapItem = {
  id: string
  title: string
  detail: string
  evidence: string
  recommended_action: string
}

export type ScenarioPlanScenario = {
  id: string
  title: string
  priority: ScenarioPriority
  preconditions: string[]
  steps: string[]
  expected_result: string
  traceability: ScenarioTraceabilityRef[]
  source_type?: ScenarioSourceType
  source_label?: string
}

export type ScenarioPlanGroup = {
  id: string
  name: string
  scenarios: ScenarioPlanScenario[]
}

export type ScenarioPlanDomain = {
  id: string
  name: string
  groups: ScenarioPlanGroup[]
}

export type ScenarioCatalogItem = ScenarioPlanScenario & {
  domain_id: string
  domain_name: string
  group_id: string
  group_name: string
  status: ScenarioCatalogStatus
  work_item_id?: string | null
  execution?: ScenarioExecution
}

export type ProjectScenarioAnalysisResult = {
  analyzed_at: string
  correlation_id?: string | null
  doc_fingerprint: string
  docs_scanned: number
  readiness_score: number
  verdict: ScenarioAnalysisVerdict
  verdict_summary: string
  limitations: string[]
  source_documents: ScenarioSourceDocumentAnalysis[]
  gap_items: ScenarioGapItem[]
  plan_domains: ScenarioPlanDomain[]
  catalog: ScenarioCatalogItem[]
  agent_mode: 'llm' | 'heuristic'
}

export type ProjectScenarioPersistedState = {
  project_id: string
  analysis: ProjectScenarioAnalysisResult
}
