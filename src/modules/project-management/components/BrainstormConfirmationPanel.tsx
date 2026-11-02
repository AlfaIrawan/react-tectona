import type { ReactNode } from 'react'
import { CircleCheck, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrainstormConfirmationStatus } from '../lib/brainstormConfirmationStatus'
import { BrainstormNotedAnswer } from './BrainstormSummaryBox'
import { splitScopedConfirmationContent } from '../lib/brainstormMarkdown'
import { brainstormConfirmationAnswerMissing } from '../lib/brainstormConfirmationContent'

export function BrainstormConfirmationPanel({ text, question, decisionText, decisionLabel, indonesian, renderText, children, status = 'pending' }: {
  text: string
  question: string
  decisionText?: string | null
  decisionLabel?: string | null
  indonesian: boolean
  renderText: (text: string) => ReactNode
  children?: ReactNode
  status?: BrainstormConfirmationStatus
}) {
  const scoped = splitScopedConfirmationContent(text)
  const decision = decisionText?.trim() ?? ''
  const missing = brainstormConfirmationAnswerMissing(text, decision)
  if (!text.trim() && !decision && !question.trim() && !children) return null
  const confirmed = status === 'confirmed' && !missing
  const Icon = confirmed ? CircleCheck : Clock3
  return (
    <section data-brainstorm-confirmation data-confirmation-status={confirmed ? 'confirmed' : 'pending'} className={cn('my-3 min-w-0 rounded-lg border px-4 py-3 text-foreground backdrop-blur-sm [overflow-wrap:anywhere]', confirmed ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30')}>
      <h3 className={cn('mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold', confirmed ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200')}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {indonesian ? 'Konfirmasi Pemahaman' : 'Confirm Understanding'}
        <span className="ml-auto font-medium">{confirmed ? (indonesian ? 'Sudah dikonfirmasi' : 'Confirmed') : (indonesian ? 'Belum dikonfirmasi' : 'Not confirmed')}</span>
      </h3>
      {decision ? <BrainstormNotedAnswer question={decisionLabel || (indonesian ? 'Batasan fase' : 'Phase scope')} answer={decision} tone={confirmed ? 'emerald' : 'amber'} /> : null}
      {scoped ? <>
        {scoped.before ? renderText(scoped.before) : null}
        <BrainstormNotedAnswer question={scoped.question} answer={scoped.answer || (indonesian ? 'Jawaban belum tersedia.' : 'Answer unavailable.')} tone={confirmed ? 'emerald' : 'amber'} />
        {scoped.after ? renderText(scoped.after) : null}
      </> : text ? renderText(text) : null}
      {missing ? <p role="alert" className="mt-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
        {indonesian ? 'Jawaban yang perlu dikonfirmasi belum tersedia. Muat ulang sesi untuk memulihkannya; jangan menyetujui sebelum jawabannya terlihat.' : 'The answer to confirm is unavailable. Reload the session to recover it; do not approve before the answer is visible.'}
      </p> : null}
      {question ? <p className="mt-3 text-sm font-semibold leading-6">{question}</p> : null}
      {missing ? <fieldset disabled className="m-0 min-w-0 border-0 p-0">{children}</fieldset> : children}
    </section>
  )
}
