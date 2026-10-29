import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'

export type LiveSummarySection = {
  id: string
  title: string
  text: string
  diagram?: { source: string; lane: 'as_is' | 'to_be'; status: 'proposed' | 'awaiting_confirmation' | 'confirmed'; version: string }
}

/** Bind confirmations to the latest saved diagram, never to a newly generated sketch. */
export function confirmedSummaryDiagramTimeline(messages: IdeaDraftJobStatusResponse['brainstorm_messages']) {
  const pending: Partial<Record<'as_is' | 'to_be', string>> = {}
  const confirmed: typeof pending = {}
  const timeline: Array<typeof pending> = []
  for (const message of messages ?? []) {
    for (const lane of message.invalidated_process_lanes ?? []) { delete pending[lane]; delete confirmed[lane] }
    if (message.role !== 'assistant' || typeof message.text !== 'string') { timeline.push({ ...confirmed }); continue }
    const text = message.text.replace(/\r\n/g, '\n')
    for (const fence of text.matchAll(/```(?:plantuml|mermaid|bpmn)\s*\n([\s\S]*?)```/gi)) {
      const headings = [...text.slice(0, fence.index).matchAll(/(?:^|\n)\s*(?:#{1,6}\s*)?(AS-IS|TO-BE)\s*[\u2014\u2013:-]/gi)]
      const heading = headings.at(-1)?.[1].toUpperCase()
      if (!heading) continue
      const lane = heading === 'AS-IS' ? 'as_is' : 'to_be'
      const source = fence[1].trim()
      if (source && pending[lane] !== source) {
        pending[lane] = source
        delete confirmed[lane]
      }
    }
    for (const lane of ['as_is', 'to_be'] as const) {
      const name = lane === 'as_is' ? 'AS-IS' : 'TO-BE'
      const ack = new RegExp(`(?:flow ${name} sudah terkonfirmasi|the ${name} flow is confirmed)`, 'i')
      if (ack.test(text) && pending[lane]) confirmed[lane] = pending[lane]
    }
    timeline.push({ ...confirmed })
  }
  return timeline
}

export function confirmedSummaryDiagrams(messages: IdeaDraftJobStatusResponse['brainstorm_messages']) {
  return confirmedSummaryDiagramTimeline(messages).at(-1) ?? {}
}

/** Latest published chat assets are visible before approval, but never labelled as facts. */
export function latestSummaryDiagrams(messages: IdeaDraftJobStatusResponse['brainstorm_messages']) {
  const latest: Partial<Record<'as_is' | 'to_be', NonNullable<LiveSummarySection['diagram']>>> = {}
  const confirmed = confirmedSummaryDiagrams(messages)
  for (const [index, message] of (messages ?? []).entries()) {
    for (const lane of message.invalidated_process_lanes ?? []) delete latest[lane]
    if (message.role !== 'assistant' || typeof message.text !== 'string') continue
    const text = message.text.replace(/\r\n/g, '\n')
    for (const fence of text.matchAll(/```(?:plantuml|mermaid|bpmn)\s*\n([\s\S]*?)```/gi)) {
      const heading = [...text.slice(0, fence.index).matchAll(/(?:^|\n)\s*(?:#{1,6}\s*)?(AS-IS|TO-BE)\s*[\u2014\u2013:-]/gi)].at(-1)?.[1].toUpperCase()
      const source = fence[1].trim()
      if (!heading || !source) continue
      const lane = heading === 'AS-IS' ? 'as_is' : 'to_be'
      const proposed = message.process_diagram_proposals?.some(proposal => proposal.lane === lane && proposal.diagram_block.includes(source))
      latest[lane] = { source, lane, version: `${index}:${lane}`, status: confirmed[lane] === source ? 'confirmed' : proposed ? 'proposed' : 'awaiting_confirmation' }
    }
  }
  return latest
}

/** Diagram delivery is independent of prose generation, including failed prose refreshes. */
export function attachLatestSummaryDiagrams(snapshot: LiveSummarySnapshot, messages: IdeaDraftJobStatusResponse['brainstorm_messages']): LiveSummarySnapshot {
  const diagrams = latestSummaryDiagrams(messages)
  const sections = snapshot.sections.filter(section => section.text.trim()).map(({ diagram: _old, ...section }) => ({ ...section } as LiveSummarySection))
  if (!sections.length) return { sections }
  for (const [lane, key, title] of [['as_is', 'as_is_evidence', 'Evidence AS-IS'], ['to_be', 'proposed_change', 'TO-BE']] as const) {
    const diagram = diagrams[lane]
    if (!diagram) continue
    let section = sections.find(row => row.id === key)
    if (!section) {
      section = { id: key, title, text: '' }
      const before = lane === 'as_is' ? sections.findIndex(row => row.id === 'proposed_change') : -1
      sections.splice(before < 0 ? sections.length : before, 0, section)
    }
    section.diagram = diagram
  }
  return { sections }
}

/** Emphasis changes presentation only; it never supplies a missing fact or KPI. */
export function styleLiveSummaryText(text: string, sectionId: string): string {
  const protectedParts = text.split(/(```[\s\S]*?```|`[^`\n]*`|\[[^\]\n]*\]\([^\n)]*\)|\*\*[^*\n]+\*\*|__[^_\n]+__)/g)
  const quantities = /\b\d+(?:[.,]\d+)?\s*(?:kbps|mbps|gb|mb|kb|menit|detik|jam|minutes?|seconds?|hours?|persen|percent|%)(?!\w)/gi
  for (let index = 0; index < protectedParts.length; index += 2) {
    protectedParts[index] = protectedParts[index].replace(quantities, value => `**${value}**`)
    if (sectionId === 'problem') protectedParts[index] = protectedParts[index].replace(/\b(manual|waktu lama|memakan waktu|time.consuming)\b/gi, value => `**${value}**`)
  }
  return protectedParts.join('')
}

export type LiveSummarySnapshot = {
  sections: LiveSummarySection[]
}

/** Resume is an explicit retry boundary; polling must not repeatedly generate summaries. */
export async function recoverBrainstormSummaryOnResume(
  job: IdeaDraftJobStatusResponse,
  recover: (jobId: string) => Promise<IdeaDraftJobStatusResponse>,
): Promise<IdeaDraftJobStatusResponse> {
  if (job.live_summary?.status !== 'unavailable' || !['awaiting_input', 'completed'].includes(job.status)) return job
  try {
    return await recover(job.job_id)
  } catch {
    // A failed retry must not prevent reopening the conversation or erase saved content.
    return job
  }
}

/** The structured proposal is separate from the per-reply understanding box. */
export function buildBrainstormLiveSummary(job: IdeaDraftJobStatusResponse | null): LiveSummarySnapshot {
  const summary = job?.live_summary
  if (!summary || summary.status === 'empty') return { sections: [] }
  if (summary.status === 'ready' && job.revision && summary.source_revision && summary.source_revision !== job.revision) return { sections: [] }
  const sections: LiveSummarySection[] = summary.sections.filter(section => section.body.trim()).map(section => ({
    id: section.key, title: section.title, text: styleLiveSummaryText(section.body, section.key),
  }))
  return attachLatestSummaryDiagrams({ sections }, job?.brainstorm_messages)
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
