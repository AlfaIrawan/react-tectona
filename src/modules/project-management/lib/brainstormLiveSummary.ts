import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'

export type LiveSummarySection = {
  id: string
  title: string
  text: string
  kind: 'understanding' | 'confirmed' | 'pending' | 'suggestion'
}

export type LiveSummarySnapshot = {
  sections: LiveSummarySection[]
  confidence: number
  confirmed: number
  total: number
}

/** A projection of the server's evidence, not another independently generated summary. */
export function buildBrainstormLiveSummary(job: IdeaDraftJobStatusResponse | null, confidence: number): LiveSummarySnapshot {
  const messages = job?.brainstorm_messages ?? []
  const latest = [...messages].reverse().find(message => message.role === 'assistant')
  const items = job?.intake_checklist?.length ? job.intake_checklist : job?.evidence_progress?.items ?? []
  const sections: LiveSummarySection[] = []
  if (latest?.summary?.trim()) sections.push({ id: 'understanding', title: 'Current understanding', text: latest.summary.trim(), kind: 'understanding' })
  for (const item of items) {
    if (!item.evidence_text?.trim() || item.evidence_status === 'missing') continue
    sections.push({
      id: `evidence:${item.id}`, title: item.prompt,
      text: item.evidence_text.trim(),
      // Workflow completion alone is not evidence confirmation.
      kind: item.evidence_status === 'confirmed' ? 'confirmed' : 'pending',
    })
  }
  const unresolved = [...new Set([
    ...(job?.brainstorm_remaining_gaps ?? []),
    ...items.filter(item => item.evidence_status !== 'confirmed' && !item.evidence_text?.trim()).map(item => item.prompt),
  ].map(text => text.trim()).filter(Boolean))]
  if (unresolved.length) sections.push({ id: 'gaps', title: 'Open points', text: unresolved.map(text => `- ${text}`).join('\n'), kind: 'pending' })
  if (latest?.ai_advice?.trim()) sections.push({ id: 'advice', title: 'AI suggestion (not confirmed)', text: latest.ai_advice.trim(), kind: 'suggestion' })
  return {
    sections,
    confidence: Math.max(0, Math.min(100, Number.isFinite(confidence) ? Math.round(confidence) : 0)),
    confirmed: items.filter(item => item.evidence_status === 'confirmed').length,
    total: items.length,
  }
}

/** Keep unchanged text on both sides; animate only the replaced range (Unicode-safe). */
export function summaryTextChange(before: string, after: string) {
  const previous = Array.from(before), next = Array.from(after)
  let prefix = 0
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++
  let suffix = 0
  while (suffix < previous.length - prefix && suffix < next.length - prefix
    && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++
  return {
    prefix: next.slice(0, prefix).join(''),
    removed: previous.slice(prefix, previous.length - suffix),
    added: next.slice(prefix, next.length - suffix),
    suffix: suffix ? next.slice(next.length - suffix).join('') : '',
  }
}
