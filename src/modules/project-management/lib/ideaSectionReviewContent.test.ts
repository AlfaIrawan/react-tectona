import { describe, expect, it } from 'vitest'
import type {
  GenerateBenefitAnalysisResponse,
  GenerateIdeaConversionResponse,
} from '@/lib/api/tectonaAgentRuntimeApi'
import {
  formatConversionReviewContent,
  formatCostBenefitReviewContent,
  normalizeLegacyStructuredReviewContent,
} from '@/modules/project-management/lib/ideaSectionReviewContent'

describe('formatCostBenefitReviewContent', () => {
  it('formats structured analysis as readable review text instead of JSON', () => {
    const analysis: GenerateBenefitAnalysisResponse = {
      idea_id: 'idea-1',
      analysis_title: 'Benefit Analysis: Helpdesk',
      executive_summary: 'The financial evidence still needs validation.',
      assumptions: [{
        assumption_key: 'annual_revenue',
        assumption_value: 100_000,
        rationale: 'Based on the current business-value score.',
        impact: 'high',
      }],
      key_metrics: [{
        metric_name: 'Efficiency gain',
        value: 10,
        unit: '%',
        interpretation: 'Initial hypothesis',
        confidence: 0.6,
      }],
      annual_breakdown: [],
      total_development_cost: 0,
      total_cost_5year: 0,
      total_benefit_5year: 0,
      roi_percentage: 0,
      payback_period_months: 0,
      npv_5year: 0,
      benefit_cost_ratio: 0,
      costs: [],
      benefits: [],
      scenarios: [],
      calculation_method: 'Evidence-first',
      confidence_score: 0.6,
      presentation_mode: 'narrative',
      narrative_points: ['Validate the cost baseline.'],
      llm_insights: 'No approved financial baseline was found.',
      key_risks_to_monitor: ['Unverified assumptions'],
      recommendations: ['Attach an approved cost model.'],
      calculated_at: '2026-08-14T10:00:00Z',
      generated_by: 'Tectona Agent',
      warnings: ['Financial values are not yet available.'],
    }

    const result = formatCostBenefitReviewContent(analysis)

    expect(result).toContain('Cost and Benefit Analysis')
    expect(result).toContain('Annual Revenue: 100.000')
    expect(result).toContain('Development cost: Not quantified')
    expect(result).toContain('Risks to Monitor')
    expect(result).not.toContain('"idea_id"')
    expect(result).not.toContain('{')
  })

  it('normalizes a legacy JSON revision before it is shown in the editor', () => {
    const legacyContent = JSON.stringify({
      idea_id: 'idea-1',
      analysis_title: 'Legacy analysis',
      executive_summary: 'Readable after migration.',
      assumptions: [],
      key_metrics: [],
      annual_breakdown: [],
      total_development_cost: 0,
      total_cost_5year: 0,
      total_benefit_5year: 0,
      roi_percentage: 0,
      payback_period_months: 0,
      npv_5year: 0,
      benefit_cost_ratio: 0,
      costs: [],
      benefits: [],
      scenarios: [],
      calculation_method: '',
      confidence_score: 0.5,
      presentation_mode: 'narrative',
      llm_insights: '',
      key_risks_to_monitor: [],
      recommendations: [],
      calculated_at: '',
      generated_by: '',
      warnings: [],
    })

    const result = normalizeLegacyStructuredReviewContent('costBenefit', legacyContent)

    expect(result).toContain('Title: Legacy analysis')
    expect(result).toContain('Readable after migration.')
    expect(result).not.toContain('"analysis_title"')
  })
})

describe('formatConversionReviewContent', () => {
  it('formats the sprint hierarchy as readable review text', () => {
    const conversion: GenerateIdeaConversionResponse = {
      idea_id: 'idea-1',
      status: 'ok',
      summary: 'Deliver the first capability in one sprint.',
      confidence_score: 0.8,
      warnings: [],
      correlation_id: 'correlation-1',
      generated_at: '2026-08-14T10:00:00Z',
      sprints: [{
        id: 'sprint-1',
        title: 'Sprint 1',
        start_date: '2026-08-17',
        end_date: '2026-08-28',
        duration_days: 10,
        epics: [{
          id: 'epic-1',
          title: 'Helpdesk foundation',
          start_date: '2026-08-17',
          end_date: '2026-08-28',
          duration_days: 10,
          tasks: [{
            id: 'task-1',
            title: 'Configure workflow',
            start_date: '2026-08-17',
            end_date: '2026-08-21',
            duration_days: 5,
            sub_tasks: [],
          }],
        }],
      }],
    }

    const result = formatConversionReviewContent(conversion)

    expect(result).toContain('Idea Conversion Plan')
    expect(result).toContain('1. Sprint 1')
    expect(result).toContain('Epic: Helpdesk foundation')
    expect(result).toContain('Task: Configure workflow')
    expect(result).not.toContain('"sprints"')
  })
})
