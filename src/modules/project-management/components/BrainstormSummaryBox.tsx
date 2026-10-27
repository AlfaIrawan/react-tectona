import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AssistantChatMarkdown } from '@/modules/core-shell/components/AssistantChatMarkdown'
import { cn } from '@/lib/utils'
import { normalizeBrainstormSummary } from '../lib/normalizeBrainstormSummary'
import { normalizeBrainstormMarkdown } from '../lib/brainstormMarkdown'
import type { ReactNode } from 'react'

/** The "Rangkuman Pemahaman" box. Always shown and open; the header folds it away (accordion). */
export function BrainstormSummaryBox({ text, indonesian, className, children }: {
  text: string
  indonesian: boolean
  className?: string
  children?: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const contentId = useId()
  const title = indonesian ? 'Rangkuman Pemahaman' : 'Summary of Understanding'
  return (
    <div className="my-2 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        title={open ? (indonesian ? 'Sembunyikan rangkuman' : 'Hide summary') : (indonesian ? 'Tampilkan rangkuman' : 'Show summary')}
        className="flex w-full items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-sky-800 hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-100"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')} aria-hidden />
        {title}
        {!open ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-sky-700/80 dark:text-sky-300/70">
            {indonesian ? '(disembunyikan)' : '(hidden)'}
          </span>
        ) : null}
      </button>
      {open ? (
        <div id={contentId} className="mt-1">
          <AssistantChatMarkdown content={normalizeBrainstormMarkdown(normalizeBrainstormSummary(text))} className={className} />
          {children}
        </div>
      ) : null}
    </div>
  )
}
