import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'
import { confirmedSummaryDiagramTimeline } from './brainstormLiveSummary'

export type SummaryDiagramAttachment = {
  lane: 'as_is' | 'to_be'
  source: string
  presentation: 'preview' | 'link'
}

/** Each historical reply uses only the diagram that was confirmed at that point. */
export function buildSummaryDiagramAttachments(messages: IdeaDraftJobStatusResponse['brainstorm_messages']): SummaryDiagramAttachment[][] {
  const timeline = confirmedSummaryDiagramTimeline(messages)
  const shown = new Set<string>()
  return (messages ?? []).map((message, index) => {
    if (message.role !== 'assistant') return []
    const attachments: SummaryDiagramAttachment[] = []
    for (const lane of ['as_is', 'to_be'] as const) {
      const source = timeline[index]?.[lane]
      if (!source) continue
      const key = `${lane}:${source}`
      const newlyConfirmed = timeline[index - 1]?.[lane] !== source
      const mentioned = lane === 'as_is'
        ? /\bAS[- ]IS\b|alur.{0,30}saat ini|current process/i.test(message.summary ?? '')
        : /\bTO[- ]BE\b|alur.{0,30}diharapkan|future process/i.test(message.summary ?? '')
      if (!newlyConfirmed && !mentioned) continue
      // The original diagram already renders in the message body; do not duplicate it.
      if (message.text.includes(source)) { shown.add(key); continue }
      attachments.push({ lane, source, presentation: shown.has(key) ? 'link' : 'preview' })
      shown.add(key)
    }
    return attachments
  })
}
