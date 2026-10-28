import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AssistantChatMarkdown } from '@/modules/core-shell/components/AssistantChatMarkdown'
import { cn } from '@/lib/utils'
import { normalizeBrainstormSummary } from '../lib/normalizeBrainstormSummary'
import { normalizeBrainstormMarkdown } from '../lib/brainstormMarkdown'
import { countUnderstandingNotes, parseUnderstandingNotes, previewUnderstandingNotes, UNDERSTANDING_PREVIEW_COUNT, understandingStartsCollapsed, type UnderstandingNote } from '../lib/understandingNotes'
import type { ReactNode } from 'react'

const NOTE_CLASS = 'text-[13px] leading-6 text-sky-950 [&_p]:m-0 [&_strong]:font-semibold dark:text-sky-50'

/** The "Rangkuman Pemahaman" box: numbered notes, not the Live AI Summary sections.
 *  A long note list starts collapsed to the first few. */
export function BrainstormSummaryBox({ text, indonesian, className, children }: {
  text: string
  indonesian: boolean
  className?: string
  children?: ReactNode
}) {
  const notes = parseUnderstandingNotes(normalizeBrainstormMarkdown(normalizeBrainstormSummary(text)))
  const long = understandingStartsCollapsed(notes)
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState(!long)
  const [seen, setSeen] = useState(text)
  if (text !== seen) {
    setSeen(text)
    setExpanded(!long)
  }
  const contentId = useId()
  const title = indonesian ? 'Rangkuman Pemahaman' : 'Summary of Understanding'
  const total = countUnderstandingNotes(notes)
  const visible = !open ? [] : expanded || !long ? notes : previewUnderstandingNotes(notes, UNDERSTANDING_PREVIEW_COUNT)
  const hiddenCount = total - countUnderstandingNotes(visible)
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
        {total > 0 ? (
          <span className="ml-auto font-normal normal-case tracking-normal text-sky-700/80 dark:text-sky-300/70">
            {indonesian ? `${total} catatan` : `${total} notes`}
          </span>
        ) : null}
      </button>
      {open ? (
        <div id={contentId} className="mt-2">
          {notes.length > 0 ? (
            <UnderstandingNoteList notes={visible} />
          ) : (
            <AssistantChatMarkdown content={normalizeBrainstormMarkdown(normalizeBrainstormSummary(text))} className={className} />
          )}
          {open && long ? (
            <button
              type="button"
              onClick={() => setExpanded(value => !value)}
              className="mt-2 text-xs font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300"
            >
              {expanded
                ? (indonesian ? 'Ciutkan' : 'Show less')
                : (indonesian ? `Tampilkan ${hiddenCount} catatan lagi` : `Show ${hiddenCount} more notes`)}
            </button>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}

function UnderstandingNoteList({ notes, prefix = '' }: { notes: UnderstandingNote[]; prefix?: string }) {
  return (
    <ol className={cn('m-0 list-none space-y-2 p-0', prefix && 'mt-2')}>
      {notes.map((note, index) => {
        const number = prefix ? `${prefix}.${index + 1}` : String(index + 1)
        return (
          <li key={`${number}-${note.text.slice(0, 24)}`}>
            <div className="flex items-start gap-2.5">
              <span className={cn(
                'mt-0.5 inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-white px-1.5 font-semibold tabular-nums text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800',
                number.length > 2 ? 'min-w-8 text-[10px]' : 'w-5 text-[10px]',
              )}>
                {number}
              </span>
              <div className="min-w-0 flex-1">
                <AssistantChatMarkdown content={note.text} className={NOTE_CLASS} />
                {note.children.length > 0 ? <UnderstandingNoteList notes={note.children} prefix={number} /> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
