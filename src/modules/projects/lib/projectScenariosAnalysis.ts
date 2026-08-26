import { chatWithTectonaAgentRuntime, type RuntimeChatEvidence } from '@/lib/api/tectonaAgentRuntimeApi'
import type { DocumentResponse } from '@/lib/api/documentKnowledgeApi'
import { extractPlainTextFromHtml } from '@/lib/richHtmlEditor'
import type {
  ProjectScenarioAnalysisResult,
  ScenarioCatalogItem,
  ScenarioGapItem,
  ScenarioPlanDomain,
  ScenarioPlanScenario,
  ScenarioSourceDocumentAnalysis,
  ScenarioSuitabilityLevel,
} from './projectScenariosTypes'
import { buildProjectDocsFingerprint } from './fetchProjectDocumentsForScenarios'

const ANALYSIS_STEPS = [
  'Scanning project documents',
  'Ranking reference suitability',
  'Building scenario plan',
  'Drafting scenario catalog',
] as const

export { ANALYSIS_STEPS }

type AgentAnalysisPayload = {
  readiness_score?: number
  verdict?: 'sufficient' | 'insufficient'
  verdict_summary?: string
  limitations?: string[]
  source_documents?: Array<{
    document_id?: string
    suitability?: ScenarioSuitabilityLevel
    suitability_score?: number
    role?: string
    evidence_quote?: string
    rationale?: string
  }>
  gap_items?: Array<{
    title?: string
    detail?: string
    evidence?: string
    recommended_action?: string
  }>
  plan_domains?: Array<{
    name?: string
    groups?: Array<{
      name?: string
      scenarios?: Array<{
        id?: string
        title?: string
        priority?: 'P1' | 'P2' | 'P3'
        preconditions?: string[]
        steps?: string[]
        expected_result?: string
        traceability?: Array<{ document_id?: string; reference?: string }>
      }>
    }>
  }>
}

function slugId(prefix: string, value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
  return `${prefix}-${slug || 'item'}-${index + 1}`
}

function inferDocumentRole(doc: DocumentResponse): string {
  const haystack = `${doc.title} ${doc.document_type_code} ${doc.tags.join(' ')} ${String(doc.metadata?.template_code ?? '')}`.toUpperCase()
  if (haystack.includes('BRD')) return 'Business requirements & scope'
  if (haystack.includes('FSD') || haystack.includes('FUNCTIONAL')) return 'Functional flows & validation'
  if (haystack.includes('URD') || haystack.includes('REQUIREMENT')) return 'User requirements & acceptance criteria'
  if (haystack.includes('TSD') || haystack.includes('TECHNICAL')) return 'Technical specification & integration'
  if (doc.document_type_code) return doc.document_type_code.replace(/_/g, ' ')
  return 'Supporting documentation'
}

function inferSuitability(doc: DocumentResponse): { level: ScenarioSuitabilityLevel; score: number; rationale: string } {
  const haystack = `${doc.title} ${doc.tags.join(' ')} ${String(doc.metadata?.template_code ?? '')}`.toUpperCase()
  const hasSummary = Boolean(doc.summary?.trim())
  const isTemplateGenerated = doc.tags.includes('from-template') || doc.tags.includes('ai-generated')

  if (/BRD|FSD|URD|TSD/.test(haystack)) {
    return {
      level: hasSummary || isTemplateGenerated ? 'high' : 'partial',
      score: hasSummary || isTemplateGenerated ? 88 : 72,
      rationale: 'Delivery artifact template (BRD/FSD/URD/TSD) suitable as structured test reference.',
    }
  }

  if (doc.document_type_code && doc.document_type_code !== 'note') {
    return {
      level: 'partial',
      score: 55,
      rationale: 'Document may contain requirements but lacks explicit test-ready structure.',
    }
  }

  return {
    level: 'low',
    score: 25,
    rationale: 'Not identified as a primary requirements or specification artifact.',
  }
}

function buildHeuristicSourceDocuments(documents: DocumentResponse[]): ScenarioSourceDocumentAnalysis[] {
  return documents.map((doc) => {
    const inferred = inferSuitability(doc)
    const evidence =
      doc.summary?.trim() ||
      `Document type ${doc.document_type_code || 'unknown'} · tags: ${doc.tags.slice(0, 4).join(', ') || 'none'}`

    return {
      document_id: doc.id,
      document_title: doc.title,
      document_type_code: doc.document_type_code,
      suitability: inferred.level,
      suitability_score: inferred.score,
      role: inferDocumentRole(doc),
      evidence_quote: evidence.slice(0, 280),
      rationale: inferred.rationale,
    }
  })
}

function countSuitableSources(sources: ScenarioSourceDocumentAnalysis[]): number {
  return sources.filter((item) => item.suitability === 'high' || item.suitability === 'partial').length
}

function buildDefaultGapItems(
  documents: DocumentResponse[],
  sources: ScenarioSourceDocumentAnalysis[],
): ScenarioGapItem[] {
  const gaps: ScenarioGapItem[] = []
  const hasBrd = sources.some((item) => item.role.toLowerCase().includes('business'))
  const hasFsd = sources.some((item) => item.role.toLowerCase().includes('functional'))
  const hasUrd = sources.some((item) => item.role.toLowerCase().includes('user requirements'))

  if (documents.length === 0) {
    gaps.push({
      id: 'gap-no-docs',
      title: 'No project documents found',
      detail: 'Project Docs is empty — there is nothing to analyze for test scenarios.',
      evidence: 'Document scan returned 0 active files in this project folder.',
      recommended_action: 'Add documents in Project Docs or generate BRD/FSD/URD from template.',
    })
    return gaps
  }

  if (!hasBrd) {
    gaps.push({
      id: 'gap-no-brd',
      title: 'Business requirements document missing',
      detail: 'No BRD-like artifact detected for business rule coverage.',
      evidence: 'Filename/tags did not match BRD or business requirement templates.',
      recommended_action: 'Generate or upload a BRD in Project Docs.',
    })
  }
  if (!hasFsd) {
    gaps.push({
      id: 'gap-no-fsd',
      title: 'Functional specification missing',
      detail: 'Functional flows and field-level validation are harder to derive without FSD.',
      evidence: 'No FSD/functional template match in scanned documents.',
      recommended_action: 'Generate FSD from template using linked Idea context.',
    })
  }
  if (!hasUrd) {
    gaps.push({
      id: 'gap-no-urd',
      title: 'User requirements / acceptance criteria thin',
      detail: 'URD or explicit acceptance criteria improve scenario expected results.',
      evidence: 'No URD template match found among project documents.',
      recommended_action: 'Add URD or enrich Idea description with measurable acceptance criteria.',
    })
  }

  return gaps
}

function flattenCatalog(planDomains: ScenarioPlanDomain[]): ScenarioCatalogItem[] {
  const catalog: ScenarioCatalogItem[] = []
  for (const domain of planDomains) {
    for (const group of domain.groups) {
      for (const scenario of group.scenarios) {
        catalog.push({
          ...scenario,
          domain_id: domain.id,
          domain_name: domain.name,
          group_id: group.id,
          group_name: group.name,
          status: 'draft',
          work_item_id: null,
        })
      }
    }
  }
  return catalog
}

function buildHeuristicPlan(input: {
  projectName: string
  ideaTitle?: string | null
  ideaDescription?: string | null
  documents: DocumentResponse[]
  sources: ScenarioSourceDocumentAnalysis[]
}): ScenarioPlanDomain[] {
  const featureLabel = input.ideaTitle?.trim() || input.projectName
  const contextSnippet = extractPlainTextFromHtml(input.ideaDescription ?? '').slice(0, 240)
  const primaryDoc =
    input.sources.find((item) => item.suitability === 'high') ?? input.sources[0]
  const traceRef = primaryDoc
    ? [{ document_id: primaryDoc.document_id, document_title: primaryDoc.document_title, reference: primaryDoc.role }]
    : []

  const baseScenarios: ScenarioPlanScenario[] = [
    {
      id: slugId('SCN', featureLabel, 0),
      title: `${featureLabel} — happy path`,
      priority: 'P1',
      preconditions: ['User authenticated', 'Required master data available'],
      steps: ['Open feature entry point', 'Complete primary flow with valid data', 'Submit / confirm action'],
      expected_result: 'Operation succeeds and confirmation is shown to the user.',
      traceability: traceRef,
    },
    {
      id: slugId('SCN', featureLabel, 1),
      title: `${featureLabel} — validation error`,
      priority: 'P2',
      preconditions: ['User authenticated'],
      steps: ['Open feature entry point', 'Submit with invalid or incomplete input'],
      expected_result: 'System blocks the action and displays a clear validation message.',
      traceability: traceRef,
    },
    {
      id: slugId('SCN', featureLabel, 2),
      title: `${featureLabel} — timeout / downstream failure`,
      priority: 'P2',
      preconditions: ['Simulated downstream service unavailable'],
      steps: ['Execute primary flow', 'Observe error handling when dependency fails'],
      expected_result: 'User receives a safe error state without data corruption.',
      traceability: traceRef,
    },
  ]

  if (contextSnippet.toLowerCase().includes('qris') || featureLabel.toLowerCase().includes('qris')) {
    baseScenarios.unshift({
      id: 'SCN-QRIS-PAYMENT-001',
      title: 'QRIS payment completed successfully',
      priority: 'P1',
      preconditions: ['User logged into OneIn', 'QRIS merchant available'],
      steps: ['Navigate to QRIS payment', 'Scan valid QR code', 'Confirm payment amount', 'Complete authentication if required'],
      expected_result: 'Payment succeeds, receipt shown, transaction recorded.',
      traceability: traceRef,
    })
  }

  return [
    {
      id: slugId('DOM', featureLabel, 0),
      name: featureLabel,
      groups: [
        {
          id: slugId('GRP', 'core', 0),
          name: 'Core functional scenarios',
          scenarios: baseScenarios,
        },
        {
          id: slugId('GRP', 'edge', 1),
          name: 'Edge & resilience',
          scenarios: [
            {
              id: slugId('SCN', 'session', 3),
              title: 'Session expired during flow',
              priority: 'P3',
              preconditions: ['User session near expiry'],
              steps: ['Start flow', 'Wait for session timeout', 'Attempt to continue'],
              expected_result: 'User is redirected to re-authenticate without losing safe state.',
              traceability: traceRef,
            },
          ],
        },
      ],
    },
  ]
}

function buildHeuristicAnalysis(input: {
  projectName: string
  ideaTitle?: string | null
  ideaDescription?: string | null
  documents: DocumentResponse[]
  fingerprint: string
}): ProjectScenarioAnalysisResult {
  const source_documents = buildHeuristicSourceDocuments(input.documents)
  const suitableCount = countSuitableSources(source_documents)
  const highCount = source_documents.filter((item) => item.suitability === 'high').length
  const gap_items = buildDefaultGapItems(input.documents, source_documents)
  const sufficient = suitableCount >= 2 && highCount >= 1
  const plan_domains = sufficient
    ? buildHeuristicPlan({
        projectName: input.projectName,
        ideaTitle: input.ideaTitle,
        ideaDescription: input.ideaDescription,
        documents: input.documents,
        sources: source_documents,
      })
    : []

  const readiness_score = sufficient
    ? Math.min(95, 45 + highCount * 15 + suitableCount * 5)
    : Math.max(5, suitableCount * 12)

  return {
    analyzed_at: new Date().toISOString(),
    correlation_id: null,
    doc_fingerprint: input.fingerprint,
    docs_scanned: input.documents.length,
    readiness_score,
    verdict: sufficient ? 'sufficient' : 'insufficient',
    verdict_summary: sufficient
      ? `Found ${suitableCount} usable reference document(s). Draft scenario plan generated from available delivery artifacts.`
      : `Only ${suitableCount} partial reference(s) detected. Add or generate BRD/FSD/URD before full scenario planning.`,
    limitations: sufficient
      ? ['Heuristic mode — re-run analysis with agent runtime for deeper document parsing.']
      : ['Insufficient structured delivery artifacts for confident scenario planning.'],
    source_documents,
    gap_items,
    plan_domains,
    catalog: flattenCatalog(plan_domains),
    agent_mode: 'heuristic',
  }
}

function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return null
}

export function parseAgentAnalysisJson(text: string): AgentAnalysisPayload | null {
  const block = extractJsonBlock(text)
  if (!block) return null
  try {
    return JSON.parse(block) as AgentAnalysisPayload
  } catch {
    return null
  }
}

function mergeAgentPayload(
  payload: AgentAnalysisPayload,
  documents: DocumentResponse[],
  fingerprint: string,
  evidence: RuntimeChatEvidence[],
  correlationId: string | null,
): ProjectScenarioAnalysisResult {
  const docById = new Map(documents.map((doc) => [doc.id, doc]))
  const heuristicSources = buildHeuristicSourceDocuments(documents)

  const source_documents: ScenarioSourceDocumentAnalysis[] =
    payload.source_documents?.length
      ? payload.source_documents.map((item, index) => {
          const doc = item.document_id ? docById.get(item.document_id) : undefined
          const fallback = heuristicSources[index] ?? heuristicSources[0]
          return {
            document_id: item.document_id ?? fallback?.document_id ?? `unknown-${index}`,
            document_title: doc?.title ?? fallback?.document_title ?? 'Unknown document',
            document_type_code: doc?.document_type_code ?? fallback?.document_type_code ?? 'document',
            suitability: item.suitability ?? fallback?.suitability ?? 'low',
            suitability_score: item.suitability_score ?? fallback?.suitability_score ?? 30,
            role: item.role ?? fallback?.role ?? inferDocumentRole(doc ?? documents[0]),
            evidence_quote: item.evidence_quote ?? fallback?.evidence_quote ?? '',
            rationale: item.rationale ?? fallback?.rationale ?? '',
          }
        })
      : heuristicSources

  const gap_items: ScenarioGapItem[] =
    payload.gap_items?.map((item, index) => ({
      id: slugId('gap', item.title ?? 'gap', index),
      title: item.title ?? 'Documentation gap',
      detail: item.detail ?? '',
      evidence: item.evidence ?? '',
      recommended_action: item.recommended_action ?? 'Review Project Docs and add missing artifacts.',
    })) ?? []

  const plan_domains: ScenarioPlanDomain[] =
    payload.plan_domains?.map((domain, domainIndex) => ({
      id: slugId('DOM', domain.name ?? 'domain', domainIndex),
      name: domain.name ?? `Domain ${domainIndex + 1}`,
      groups: (domain.groups ?? []).map((group, groupIndex) => ({
        id: slugId('GRP', group.name ?? 'group', groupIndex),
        name: group.name ?? `Group ${groupIndex + 1}`,
        scenarios: (group.scenarios ?? []).map((scenario, scenarioIndex) => ({
          id: scenario.id ?? slugId('SCN', scenario.title ?? 'scenario', scenarioIndex),
          title: scenario.title ?? `Scenario ${scenarioIndex + 1}`,
          priority: scenario.priority ?? 'P2',
          preconditions: scenario.preconditions ?? [],
          steps: scenario.steps ?? [],
          expected_result: scenario.expected_result ?? '',
          traceability: (scenario.traceability ?? []).map((ref) => ({
            document_id: ref.document_id ?? '',
            document_title: ref.document_id ? docById.get(ref.document_id)?.title ?? null : null,
            reference: ref.reference ?? '',
          })),
        })),
      })),
    })) ?? []

  const verdict =
    payload.verdict ??
    (plan_domains.length > 0 && countSuitableSources(source_documents) >= 1 ? 'sufficient' : 'insufficient')

  const limitations = [
    ...(payload.limitations ?? []),
    ...(evidence.length ? [`Agent returned ${evidence.length} evidence reference(s).`] : []),
  ]

  return {
    analyzed_at: new Date().toISOString(),
    correlation_id: correlationId,
    doc_fingerprint: fingerprint,
    docs_scanned: documents.length,
    readiness_score: Math.max(0, Math.min(100, payload.readiness_score ?? 0)),
    verdict,
    verdict_summary:
      payload.verdict_summary ??
      (verdict === 'sufficient'
        ? 'Agent produced a scenario plan from project documentation.'
        : 'Agent could not derive enough test scenarios from current documentation.'),
    limitations,
    source_documents,
    gap_items,
    plan_domains,
    catalog: flattenCatalog(plan_domains),
    agent_mode: 'llm',
  }
}

function buildAgentPrompt(input: {
  projectName: string
  projectDescription?: string
  ideaTitle?: string | null
  ideaDescription?: string | null
  documents: DocumentResponse[]
}): string {
  const ideaText = extractPlainTextFromHtml(input.ideaDescription ?? '').slice(0, 2500)
  const docLines = input.documents
    .map((doc) => {
      const templateCode = doc.metadata?.template_code ? String(doc.metadata.template_code) : ''
      return [
        `- document_id: ${doc.id}`,
        `  title: ${doc.title}`,
        `  type: ${doc.document_type_code}`,
        `  category: ${doc.category_code}`,
        `  summary: ${(doc.summary ?? '').slice(0, 400)}`,
        `  tags: ${doc.tags.join(', ') || 'none'}`,
        `  template_code: ${templateCode || 'none'}`,
      ].join('\n')
    })
    .join('\n')

  return `You are a senior QA test architect for enterprise delivery.

Analyze the project documents below and decide which can support test scenario planning.
Return ONLY valid JSON (no markdown outside the JSON object) matching this schema:
{
  "readiness_score": number,
  "verdict": "sufficient" | "insufficient",
  "verdict_summary": string,
  "limitations": string[],
  "source_documents": [{
    "document_id": string,
    "suitability": "high" | "partial" | "low",
    "suitability_score": number,
    "role": string,
    "evidence_quote": string,
    "rationale": string
  }],
  "gap_items": [{
    "title": string,
    "detail": string,
    "evidence": string,
    "recommended_action": string
  }],
  "plan_domains": [{
    "name": string,
    "groups": [{
      "name": string,
      "scenarios": [{
        "id": string,
        "title": string,
        "priority": "P1" | "P2" | "P3",
        "preconditions": string[],
        "steps": string[],
        "expected_result": string,
        "traceability": [{ "document_id": string, "reference": string }]
      }]
    }]
  }]
}

Rules:
- If verdict is insufficient, still fill source_documents and gap_items with evidence; plan_domains may be [].
- evidence_quote must cite document content or explicitly state what is missing.
- Prefer Indonesian business language when documents are in Indonesian.
- Use document_id values exactly as provided.
- Make every scenario step executable and specific: identify the actor, screen or control, input/data, and action where the documents support it; avoid vague steps such as "process the flow".
- Prefer 3-8 ordered steps per scenario and make the final step verify an observable expected outcome.

Project: ${input.projectName}
Project notes: ${extractPlainTextFromHtml(input.projectDescription ?? '').slice(0, 800) || 'none'}
Linked idea: ${input.ideaTitle ?? 'none'}
Idea context:
${ideaText || 'none'}

Documents:
${docLines || 'none'}`
}

export async function analyzeProjectScenarios(input: {
  projectId: string
  projectName: string
  projectDescription?: string
  workspaceId?: string | null
  ideaTitle?: string | null
  ideaDescription?: string | null
  documents: DocumentResponse[]
  fingerprint?: string
  preferLlm?: boolean
}): Promise<ProjectScenarioAnalysisResult> {
  const fingerprint = input.fingerprint ?? buildProjectDocsFingerprint(input.documents)

  if (!input.preferLlm) {
    return buildHeuristicAnalysis({
      projectName: input.projectName,
      ideaTitle: input.ideaTitle,
      ideaDescription: input.ideaDescription,
      documents: input.documents,
      fingerprint,
    })
  }

  try {
    const response = await chatWithTectonaAgentRuntime(
      {
        message: buildAgentPrompt(input),
        context: {
          workspace_id: input.workspaceId ?? null,
          ui: {
            pathname: `/projects/${input.projectId}`,
            module_label: 'Project Management',
            view_label: 'Scenarios',
            entity_type: 'project',
            entity_id: input.projectId,
            entity_title: input.projectName,
            project_id: input.projectId,
            data_summary: `${input.documents.length} project documents scanned for test scenario planning.`,
            extra_notes: input.ideaTitle ? [`Linked idea: ${input.ideaTitle}`] : [],
            preferred_language: 'id',
          },
        },
        options: {
          mode: 'llm_first',
          allow_llm: true,
          max_evidence: 12,
        },
      },
      180_000,
    )

    const parsed = parseAgentAnalysisJson(response.answer)
    if (parsed) {
      return mergeAgentPayload(parsed, input.documents, fingerprint, response.evidence, response.correlation_id)
    }
  } catch {
    // fall through to heuristic
  }

  return buildHeuristicAnalysis({
    projectName: input.projectName,
    ideaTitle: input.ideaTitle,
    ideaDescription: input.ideaDescription,
    documents: input.documents,
    fingerprint,
  })
}

export function suitabilityBadgeClass(level: ScenarioSuitabilityLevel): string {
  switch (level) {
    case 'high':
      return 'border-emerald-200/70 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
    case 'partial':
      return 'border-amber-200/70 bg-amber-50/80 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100'
    default:
      return 'border-border/60 bg-muted/30 text-muted-foreground'
  }
}

export function scenarioStatusBadgeClass(status: ScenarioCatalogItem['status']): string {
  switch (status) {
    case 'ready':
      return 'border-emerald-200/70 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
    case 'reviewed':
      return 'border-sky-200/70 bg-sky-50/80 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200'
    default:
      return 'border-border/60 bg-muted/30 text-muted-foreground'
  }
}
