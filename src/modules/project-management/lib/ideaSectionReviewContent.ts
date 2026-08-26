import type {
  GenerateBenefitAnalysisResponse,
  GenerateIdeaConversionResponse,
} from '@/lib/api/tectonaAgentRuntimeApi'
import type { IdeaPanelKey } from '@/modules/project-management/lib/ideaPanelCatalog'

function humanizeKey(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return 'Not available'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)
}

function formatConfidence(value: number) {
  const percentage = value <= 1 ? value * 100 : value
  return `${Math.round(Math.max(0, Math.min(100, percentage)))}%`
}

function formatUnknownValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided'
  if (typeof value === 'number') return formatNumber(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatUnknownValue).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, entry]) => `${humanizeKey(key)}: ${formatUnknownValue(entry)}`)
      .join('; ')
  }
  return String(value)
}

function section(title: string, lines: Array<string | false | null | undefined>) {
  const content = lines.filter((line): line is string => Boolean(line?.trim()))
  return content.length ? [title, ...content].join('\n') : ''
}

function bullet(value: string) {
  return `- ${value}`
}

function formatMetricValue(value: number, unit: string) {
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

export function formatCostBenefitReviewContent(analysis: GenerateBenefitAnalysisResponse): string {
  const narrativeOnly = analysis.presentation_mode === 'narrative'
  const quantifiedValue = (value: number) => narrativeOnly && value === 0 ? 'Not quantified' : formatNumber(value)

  const sections = [
    section('Cost and Benefit Analysis', [
      analysis.analysis_title && `Title: ${analysis.analysis_title}`,
      `Status: ${narrativeOnly ? 'Qualitative analysis' : 'Quantified analysis'}`,
      `Confidence: ${formatConfidence(analysis.confidence_score)}`,
    ]),
    section('Executive Summary', [analysis.executive_summary]),
    section('Financial Overview', [
      `Development cost: ${quantifiedValue(analysis.total_development_cost)}`,
      `Total cost (5 years): ${quantifiedValue(analysis.total_cost_5year)}`,
      `Total benefit (5 years): ${quantifiedValue(analysis.total_benefit_5year)}`,
      `ROI: ${narrativeOnly && analysis.roi_percentage === 0 ? 'Not quantified' : `${formatNumber(analysis.roi_percentage)}%`}`,
      `Payback period: ${narrativeOnly && analysis.payback_period_months === 0 ? 'Not quantified' : `${formatNumber(analysis.payback_period_months)} months`}`,
      `NPV (5 years): ${quantifiedValue(analysis.npv_5year)}`,
      `Benefit-cost ratio: ${narrativeOnly && analysis.benefit_cost_ratio === 0 ? 'Not quantified' : formatNumber(analysis.benefit_cost_ratio)}`,
      analysis.calculation_method && `Calculation method: ${analysis.calculation_method}`,
    ]),
    section('Key Metrics', analysis.key_metrics?.map((metric) => bullet(
      `${metric.metric_name}: ${formatMetricValue(metric.value, metric.unit)} | ${metric.interpretation} | Confidence ${formatConfidence(metric.confidence)}`,
    )) ?? []),
    section('Assumptions', analysis.assumptions?.map((assumption) => bullet(
      `${humanizeKey(assumption.assumption_key)}: ${formatUnknownValue(assumption.assumption_value)}${assumption.rationale ? ` | ${assumption.rationale}` : ''}${assumption.impact ? ` | Impact: ${assumption.impact}` : ''}`,
    )) ?? []),
    section('Cost Items', analysis.costs?.map((cost) => bullet(
      `${cost.category}: ${cost.description} | Amount ${formatNumber(cost.amount)}${cost.timing ? ` | ${cost.timing}` : ''}${cost.source ? ` | Source: ${cost.source}` : ''}`,
    )) ?? []),
    section('Benefit Items', analysis.benefits?.map((benefit) => bullet(
      `${benefit.category}: ${benefit.description} | Amount ${formatNumber(benefit.amount)}${benefit.timing ? ` | ${benefit.timing}` : ''}${benefit.source ? ` | Source: ${benefit.source}` : ''}`,
    )) ?? []),
    section('Annual Breakdown', analysis.annual_breakdown?.map((year) => bullet(
      `Year ${year.year}: Costs ${formatNumber(year.costs)} | Efficiency gains ${formatNumber(year.efficiency_gains)} | Revenue gains ${formatNumber(year.revenue_gains)} | Net benefit ${formatNumber(year.net_benefit)} | Cumulative benefit ${formatNumber(year.cumulative_benefit)}`,
    )) ?? []),
    section('Scenarios', analysis.scenarios?.map((scenario, index) => bullet(
      `Scenario ${index + 1}: ${formatUnknownValue(scenario)}`,
    )) ?? []),
    section('Narrative Insights', [
      ...(analysis.narrative_points?.map(bullet) ?? []),
      analysis.llm_insights,
    ]),
    section('Risks to Monitor', analysis.key_risks_to_monitor?.map(bullet) ?? []),
    section('Recommendations', analysis.recommendations?.map(bullet) ?? []),
    section('Warnings', analysis.warnings?.map(bullet) ?? []),
    section('Generation Details', [
      analysis.generated_by && `Generated by: ${analysis.generated_by}`,
      analysis.calculated_at && `Calculated at: ${analysis.calculated_at}`,
    ]),
  ]

  return sections.filter(Boolean).join('\n\n')
}

export function formatConversionReviewContent(conversion: GenerateIdeaConversionResponse): string {
  const sprintLines = conversion.sprints.flatMap((sprint, sprintIndex) => {
    const lines = [
      `${sprintIndex + 1}. ${sprint.title} (${sprint.start_date} to ${sprint.end_date}, ${sprint.duration_days} days)`,
    ]

    sprint.epics.forEach((epic) => {
      lines.push(`   Epic: ${epic.title} (${epic.start_date} to ${epic.end_date}, ${epic.duration_days} days)`)
      epic.tasks.forEach((task) => {
        lines.push(`     Task: ${task.title} (${task.start_date} to ${task.end_date}, ${task.duration_days} days)`)
        task.sub_tasks.forEach((subTask) => {
          lines.push(`       Sub-task: ${subTask.title} (${subTask.start_date} to ${subTask.end_date}, ${subTask.duration_days} days)`)
        })
      })
    })

    return lines
  })

  return [
    section('Idea Conversion Plan', [
      `Status: ${humanizeKey(conversion.status)}`,
      `Confidence: ${formatConfidence(conversion.confidence_score)}`,
    ]),
    section('Summary', [conversion.summary]),
    section('Delivery Timeline', sprintLines),
    section('Warnings', conversion.warnings?.map(bullet) ?? []),
    section('Generation Details', [conversion.generated_at && `Generated at: ${conversion.generated_at}`]),
  ].filter(Boolean).join('\n\n')
}

export function normalizeLegacyStructuredReviewContent(sectionKey: IdeaPanelKey, content: string): string {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') || (sectionKey !== 'costBenefit' && sectionKey !== 'conversion')) {
    return content
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (sectionKey === 'costBenefit' && typeof parsed.analysis_title === 'string') {
      return formatCostBenefitReviewContent(parsed as unknown as GenerateBenefitAnalysisResponse)
    }
    if (sectionKey === 'conversion' && Array.isArray(parsed.sprints)) {
      return formatConversionReviewContent(parsed as unknown as GenerateIdeaConversionResponse)
    }
  } catch {
    return content
  }

  return content
}
