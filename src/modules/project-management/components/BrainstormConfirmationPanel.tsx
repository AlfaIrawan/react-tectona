import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import { BrainstormNotedAnswer } from './BrainstormSummaryBox'
import { splitScopedConfirmation } from '../lib/brainstormMarkdown'

export function BrainstormConfirmationPanel({ text, question, indonesian, renderText, children }: {
  text: string
  question: string
  indonesian: boolean
  renderText: (text: string) => ReactNode
  children?: ReactNode
}) {
  const scoped = splitScopedConfirmation(text)
  return (
    <section data-brainstorm-confirmation className="my-3 min-w-0 rounded-lg border border-sky-200/90 bg-sky-50/50 px-4 py-3 text-foreground backdrop-blur-sm [overflow-wrap:anywhere] dark:border-sky-800 dark:bg-sky-950/25">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-sky-800 dark:text-sky-200">
        <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
        {indonesian ? 'Konfirmasi Pemahaman' : 'Confirm Understanding'}
      </h3>
      {scoped ? <>
        {scoped.before ? renderText(scoped.before) : null}
        <BrainstormNotedAnswer question={scoped.question} answer={scoped.answer} />
        {scoped.after ? renderText(scoped.after) : null}
      </> : text ? renderText(text) : null}
      {question ? <p className="mt-3 text-sm font-semibold leading-6">{question}</p> : null}
      {children}
    </section>
  )
}
