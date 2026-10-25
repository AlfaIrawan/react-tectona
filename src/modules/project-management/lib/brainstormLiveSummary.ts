import type { IdeaDraftJobStatusResponse } from '@/lib/api/tectonaAgentRuntimeApi'

export type LiveSummarySection = {
  id: string
  title: string
  text: string
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
  return { sections: summary.sections.filter(section => section.body.trim()).map(section => ({
    id: section.key, title: section.title, text: section.body,
  })) }
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
