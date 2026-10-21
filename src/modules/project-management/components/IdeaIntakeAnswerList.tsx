import { useState } from 'react'
import { AlertTriangle, Check, Loader2, PencilLine, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { IdeaIntakeAnswer, IdeaIntakeFollowup } from '@/lib/api/tectonaAgentRuntimeApi'
import { cn } from '@/lib/utils'
import { brainstormIntakeOrder } from '@/modules/project-management/lib/brainstormIntakeOrder'

// The AI's follow-ups are told apart from the mandatory questions by colour (and an indent).
const FOLLOWUP_CARD = 'border-violet-200/80 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/[0.07]'
const FOLLOWUP_LABEL = 'text-violet-700 dark:text-violet-300'

function FollowupCard({ question, answer }: { question: string; answer: string | null }) {
  return (
    <article
      className={cn(
        'grid gap-2 rounded-lg border p-3 sm:ml-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-4',
        answer === null ? 'border-dashed border-violet-300/80 bg-background dark:border-violet-500/40' : FOLLOWUP_CARD,
      )}
    >
      <div>
        <p className={cn('mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em]', FOLLOWUP_LABEL)}>
          <Sparkles className="h-3 w-3" aria-hidden />
          AI follow-up
        </p>
        <p className="text-sm leading-5 text-foreground">{question}</p>
      </div>
      <div className="sm:border-l sm:border-border/70 sm:pl-4">
        {answer === null ? (
          <>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Not answered</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Skipped in the brainstorm. The generator is told to mark it as to be confirmed, not to fill it in.
            </p>
          </>
        ) : (
          <>
            <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]', FOLLOWUP_LABEL)}>Answer</p>
            <p className="whitespace-pre-wrap text-sm leading-5 text-foreground/90">{answer}</p>
          </>
        )}
      </div>
    </article>
  )
}

/**
 * The idea's brainstorm in the Generate dialog, in the order it was asked: the Idea Intake answers
 * with the AI's follow-up questions after the question they followed (answered, or skipped).
 * An answer the brainstorm recorded wrongly (needs_review) is shown with the reason and is not
 * sent to the generator until the proposer corrects it — or keeps it as written, which also
 * confirms it.
 */
export function IdeaIntakeAnswerList({
  answers,
  followups = [],
  openPoints = [],
  openPointTurns = [],
  disabled,
  onSave,
}: {
  answers: IdeaIntakeAnswer[]
  followups?: IdeaIntakeFollowup[]
  /** Follow-ups skipped in the brainstorm, and the message that asked each. */
  openPoints?: string[]
  openPointTurns?: Array<number | null>
  disabled: boolean
  /** Saves the answer; rejects with a readable error. */
  onSave: (itemId: string, answer: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; message: string } | null>(null)

  const startEdit = (item: IdeaIntakeAnswer, text?: string) => {
    setEditingId(item.id)
    setDraft(text ?? (item.needs_review ? '' : item.answer))
    setError(null)
  }
  const save = async (itemId: string, text: string) => {
    const answer = text.trim()
    if (!answer) {
      setError({ id: itemId, message: 'Enter an answer first.' })
      return
    }
    setSavingId(itemId)
    setError(null)
    try {
      await onSave(itemId, answer)
      setEditingId(null)
    } catch (saveError) {
      setError({ id: itemId, message: saveError instanceof Error ? saveError.message : "Couldn't save the answer. Try again." })
    } finally {
      setSavingId(null)
    }
  }

  const pending = answers.filter((item) => item.needs_review).length
  const entries = brainstormIntakeOrder(answers, followups, openPoints, openPointTurns)

  return (
    <div className="space-y-2">
      {pending > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {pending === 1 ? '1 answer needs' : `${pending} answers need`} checking. It isn't sent to the generator until you
            correct it or keep it as written.
          </span>
        </div>
      ) : null}
      {followups.length + openPoints.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-border bg-muted/40" />
            Mandatory question
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-violet-300 bg-violet-100 dark:border-violet-500/50 dark:bg-violet-500/20" />
            AI follow-up
          </span>
          <span>In the order the brainstorm asked them.</span>
        </p>
      ) : null}
      {entries.map((entry, entryIndex) => {
        if (entry.kind === 'followup') {
          return <FollowupCard key={`f-${entryIndex}-${entry.item.question}`} question={entry.item.question} answer={entry.item.answer} />
        }
        if (entry.kind === 'skipped') {
          return <FollowupCard key={`s-${entryIndex}-${entry.question}`} question={entry.question} answer={null} />
        }
        const item = entry.item
        const editing = editingId === item.id
        const saving = savingId === item.id
        return (
          <article
            key={item.id}
            className={cn(
              'grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-4',
              item.needs_review
                ? 'border-amber-300/80 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5'
                : 'border-border/70 bg-muted/20',
            )}
          >
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Question</p>
              <p className="text-sm leading-5 text-foreground">{item.question}</p>
            </div>
            <div className="sm:border-l sm:border-border/70 sm:pl-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.12em]',
                  item.needs_review ? 'text-amber-700 dark:text-amber-300' : 'text-primary',
                )}
                >
                  {item.needs_review ? 'Needs checking' : item.corrected ? 'Answer · corrected' : 'Answer'}
                </p>
                {!editing ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    disabled={disabled || savingId !== null}
                    onClick={() => startEdit(item)}
                  >
                    <PencilLine className="h-3 w-3" aria-hidden />
                    {item.needs_review ? 'Correct' : 'Edit'}
                  </button>
                ) : null}
              </div>
              {editing ? (
                <div className="space-y-2">
                  {item.needs_review ? (
                    <p className="text-xs leading-5 text-muted-foreground">Recorded: “{item.answer}”</p>
                  ) : null}
                  <Textarea
                    autoFocus
                    rows={3}
                    aria-label={`Answer to: ${item.question}`}
                    className="min-h-[72px] w-full resize-y rounded-lg text-sm"
                    value={draft}
                    disabled={saving}
                    placeholder="Divisi Customer Lifetime Value"
                    onChange={(event) => {
                      setDraft(event.target.value)
                      if (error?.id === item.id) setError(null)
                    }}
                  />
                  {item.suggestion && draft === item.suggestion ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Taken from the brainstorm as written. Fix any typo before saving.
                    </p>
                  ) : null}
                  {error?.id === item.id ? <p className="text-xs text-destructive">{error.message}</p> : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" className="h-8 text-xs" disabled={saving} onClick={() => void save(item.id, draft)}>
                      {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                      Save answer
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={cn(
                    'whitespace-pre-wrap text-sm leading-5',
                    item.needs_review ? 'text-muted-foreground' : 'text-foreground/90',
                  )}
                  >
                    {item.answer}
                  </p>
                  {item.needs_review ? (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">{item.review_reason}</p>
                      {item.suggestion ? (
                        <div className="rounded-md border border-border/70 bg-background px-2.5 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">From the brainstorm</p>
                          <p className="text-sm leading-5 text-foreground">“{item.suggestion}”</p>
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                            disabled={disabled || savingId !== null}
                            onClick={() => startEdit(item, item.suggestion)}
                          >
                            <PencilLine className="h-3 w-3" aria-hidden />
                            Use this
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                        disabled={disabled || savingId !== null}
                        onClick={() => void save(item.id, item.answer)}
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
                        Keep as written
                      </button>
                      {error?.id === item.id ? <p className="text-xs text-destructive">{error.message}</p> : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
