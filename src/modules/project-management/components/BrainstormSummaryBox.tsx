import { AssistantChatMarkdown } from '@/modules/core-shell/components/AssistantChatMarkdown'
import { normalizeBrainstormSummary } from '../lib/normalizeBrainstormSummary'

export function BrainstormSummaryBox({ text, indonesian, className }: {
  text: string
  indonesian: boolean
  className?: string
}) {
  return (
    <div className="my-2 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
        {indonesian ? 'Rangkuman Pemahaman' : 'Summary of Understanding'}
      </p>
      <AssistantChatMarkdown content={normalizeBrainstormSummary(text)} className={className} />
    </div>
  )
}
