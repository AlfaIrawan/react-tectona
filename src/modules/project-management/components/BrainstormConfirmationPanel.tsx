import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import { BrainstormNotedAnswer } from './BrainstormSummaryBox'
import { scopedConfirmationAnswerMissing, splitScopedConfirmationContent } from '../lib/brainstormMarkdown'

export function BrainstormConfirmationPanel({ text, question, indonesian, renderText, children }: {
  text: string
  question: string
  indonesian: boolean
  renderText: (text: string) => ReactNode
  children?: ReactNode
}) {
  const scoped = splitScopedConfirmationContent(text)
  return (
    <section data-brainstorm-confirmation className="my-3 min-w-0 rounded-lg border border-sky-200/90 bg-sky-50/50 px-4 py-3 text-foreground backdrop-blur-sm [overflow-wrap:anywhere] dark:border-sky-800 dark:bg-sky-950/25">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-sky-800 dark:text-sky-200">
        <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
        {indonesian ? 'Konfirmasi Pemahaman' : 'Confirm Understanding'}
      </h3>
      {scoped ? <>
        {scoped.before ? renderText(scoped.before) : null}
        <BrainstormNotedAnswer question={scoped.question} answer={scoped.answer || (indonesian ? 'Jawaban belum tersedia.' : 'Answer unavailable.')} />
        {scoped.after ? renderText(scoped.after) : null}
      </> : text ? renderText(text) : null}
      {scopedConfirmationAnswerMissing(text) ? <p role="alert" className="mt-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
        {indonesian ? 'Jawaban yang perlu dikonfirmasi belum tersedia. Muat ulang sesi untuk memulihkannya; jangan menyetujui sebelum jawabannya terlihat.' : 'The answer to confirm is unavailable. Reload the session to recover it; do not approve before the answer is visible.'}
      </p> : null}
      {question ? <p className="mt-3 text-sm font-semibold leading-6">{question}</p> : null}
      {children}
    </section>
  )
}
