// The summary cards a reviewer may rewrite in place. The title (from the idea)
// and every figure (from the scoring service) stay locked; idea-backlog rejects
// edits to anything outside this list.
export const SUMMARY_FIELD_LABELS = {
  executive_brief: 'Executive Brief',
  core_pressure: 'Core Pressure',
  strategic_response: 'Strategic Response',
  value_thesis: 'Value Thesis',
  board_note: 'Board Note',
} as const

/** A Strategic Framing item, keyed by its (locked) title: "strategic_framing:execution_plan". */
export type FramingFieldKey = `strategic_framing:${string}`
/** A Governance Readiness signal: comment-only, never edited (it is a system assessment). */
export type ReadinessAnchorKey = `governance_readiness:${string}`
/** A Scoring dimension's rationale: "scoring:roi". The score itself stays locked. */
export type ScoringFieldKey = `scoring:${ScoringDimension}`
export type SummaryFieldKey = keyof typeof SUMMARY_FIELD_LABELS | FramingFieldKey | ScoringFieldKey

export const SCORING_DIMENSION_LABELS = {
  business_value: 'Business Value',
  roi: 'ROI',
  effort: 'Effort',
  risk: 'Risk',
} as const
export type ScoringDimension = keyof typeof SCORING_DIMENSION_LABELS

const FRAMING_KEY_RE = /^strategic_framing:[a-z0-9_]{1,40}$/
const SCORING_KEY_RE = /^scoring:(business_value|roi|effort|risk)$/

/** Same key idea-backlog derives from a scoring dimension. */
export function scoringFieldKey(dimension: ScoringDimension): ScoringFieldKey {
  return `scoring:${dimension}`
}

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
}

/** Same key idea-backlog and agent-runtime derive from the item title. */
export function framingFieldKey(title: string): FramingFieldKey {
  return `strategic_framing:${slugOf(title)}`
}

export function readinessAnchorKey(title: string): ReadinessAnchorKey {
  return `governance_readiness:${slugOf(title)}`
}

export function isEditableSummaryFieldKey(key: string): key is SummaryFieldKey {
  return key in SUMMARY_FIELD_LABELS || FRAMING_KEY_RE.test(key) || SCORING_KEY_RE.test(key)
}

function titleFromSlug(slug: string): string {
  return slug.split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

/** Display label for any summary field or item anchor. */
export function summaryFieldLabel(key: string, title?: string): string {
  if (key in SUMMARY_FIELD_LABELS) return SUMMARY_FIELD_LABELS[key as keyof typeof SUMMARY_FIELD_LABELS]
  if (key.startsWith('strategic_framing:')) return `Strategic Framing · ${title ?? titleFromSlug(key.slice(18))}`
  if (key.startsWith('governance_readiness:')) return `Governance Readiness · ${title ?? titleFromSlug(key.slice(21))}`
  if (SCORING_KEY_RE.test(key)) return `${SCORING_DIMENSION_LABELS[key.slice(8) as ScoringDimension]} rationale`
  return key
}
