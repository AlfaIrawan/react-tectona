import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'

export type LiveSummarySection = {
  id: string
  title: string
  text: string
}

export type LiveSummarySnapshot = {
  sections: LiveSummarySection[]
}

/** A projection of the server's evidence, not another independently generated summary. */
export function buildBrainstormLiveSummary(job: IdeaDraftJobStatusResponse | null): LiveSummarySnapshot {
  const messages = job?.brainstorm_messages ?? []
  const latest = [...messages].reverse().find(message => message.role === 'assistant')
  const sections: LiveSummarySection[] = []
  if (latest?.summary?.trim()) sections.push({ id: 'understanding', title: 'Current understanding', text: latest.summary.trim() })
  return { sections }
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
