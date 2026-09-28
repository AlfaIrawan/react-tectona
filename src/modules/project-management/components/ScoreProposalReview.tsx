import { useState } from 'react'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { IdeaSectionRevisionApi } from '@/lib/api/ideaBacklogApi'
import { reviewIdeaScoring, type IdeaScoringReview } from '@/lib/api/tectonaAgentRuntimeApi'
import { enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { REVIEW_ACTION_TONE } from '@/modules/project-management/lib/reviewActionTone'
import { SCORE_DRAFT_DIMENSIONS } from '@/modules/project-management/components/IdeaScoringDraftEditor'

type DimensionScore = { score: number; reason: string; change_reason?: string }
export type ScoreProposal = {
  proposed: Record<string, DimensionScore>
  ai: Record<string, DimensionScore> | null
  changes: Array<{ key: string; label: string; ai_score: number; score: number; delta: number; major: boolean; change_reason: string }>
}

/** A Scoring revision's proposed scores ("Score this idea"), or null for any other revision. */
export function scoreProposalOf(revision: IdeaSectionRevisionApi): ScoreProposal | null {
  const content = (revision.content_json ?? {}) as Record<string, unknown>
  const proposed = content.proposed_scores
  if (!proposed || typeof proposed !== 'object') return null
  const review = (content._review ?? {}) as { score_changes?: ScoreProposal['changes'] }
  return {
    proposed: proposed as ScoreProposal['proposed'],
    ai: (content.ai_scores as ScoreProposal['ai']) ?? null,
    changes: review.score_changes ?? [],
  }
}

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  supported: { label: 'Supported', className: 'text-emerald-700' },
  questionable: { label: 'Questionable', className: 'text-amber-700' },
  unsupported: { label: 'Unsupported', className: 'text-rose-700' },
}

/**
 * What a reviewer needs to decide on proposed scores: each score next to the
 * AI draft, the reason for every change, big jumps flagged, and an advisory
 * AI check against the idea's data (agent-runtime /idea-scoring/review).
 */
export function ScoreProposalReview({ ideaId, revisionId, proposal, canReview }: {
  ideaId: string
  revisionId: string
  proposal: ScoreProposal
  /** Only a pending proposal can still be checked. */
  canReview: boolean
}) {
  const [check, setCheck] = useState<{ loading: boolean; result?: IdeaScoringReview; error?: string } | null>(null)
  const changeOf = (key: string) => proposal.changes.find((c) => c.key === key)

  const runCheck = async () => {
    setCheck({ loading: true })
    try {
      setCheck({ loading: false, result: await reviewIdeaScoring(ideaId, revisionId) })
    } catch (e) {
      setCheck({ loading: false, error: e instanceof Error ? e.message : 'The AI check failed.' })
    }
  }

  return (
    <div className="mt-3 space-y-2 text-xs" aria-label="Score proposal">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[520px] border-collapse">
          <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Dimension</th>
              <th className="px-2 py-1.5 font-semibold">AI draft</th>
              <th className="px-2 py-1.5 font-semibold">Proposed</th>
              <th className="px-2 py-1.5 font-semibold">Reason / why changed</th>
              {check?.result ? <th className="px-2 py-1.5 font-semibold">AI check</th> : null}
            </tr>
          </thead>
          <tbody>
            {SCORE_DRAFT_DIMENSIONS.map(({ key, label }) => {
              const item = proposal.proposed[key]
              const ai = proposal.ai?.[key]
              const change = changeOf(key)
              const verdict = check?.result?.dimensions[key]
              return (
                <tr key={key} className="border-t border-border align-top">
                  <td className="px-2 py-1.5 font-medium text-foreground">{label}</td>
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{ai ? `${ai.score}/10` : '—'}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    <span className={cn('font-semibold', change ? 'text-foreground' : 'text-muted-foreground')}>{item?.score}/10</span>
                    {change ? (
                      <span className={cn('ml-1 font-semibold', change.major ? 'text-rose-700' : 'text-amber-700')}>
                        ({change.delta > 0 ? '+' : ''}{change.delta})
                      </span>
                    ) : null}
                    {change?.major ? (
                      <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> Major change
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    <p className="whitespace-pre-wrap break-words">{item?.reason}</p>
                    {change ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-foreground">
                        <span className="font-semibold">Why changed: </span>{change.change_reason || '—'}
                      </p>
                    ) : null}
                  </td>
                  {check?.result ? (
                    <td className="px-2 py-1.5">
                      {verdict ? (
                        <>
                          <p className={cn('font-semibold', VERDICT_STYLE[verdict.verdict]?.className)}>{VERDICT_STYLE[verdict.verdict]?.label ?? verdict.verdict}</p>
                          <p className="mt-0.5 text-muted-foreground">{verdict.note}</p>
                          {verdict.evidence_quote ? <p className="mt-0.5 italic text-muted-foreground">“{verdict.evidence_quote}”</p> : null}
                        </>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {proposal.changes.some((c) => c.major) ? (
        <p className="flex items-center gap-1.5 font-medium text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> A major change from the AI draft needs an approval comment.
        </p>
      ) : null}

      {canReview ? (
        <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), REVIEW_ACTION_TONE.outline, 'gap-1.5 px-3')}
          disabled={check?.loading} onClick={() => void runCheck()}>
          {check?.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
          Check with AI
        </Button>
      ) : null}
      {check?.error ? <p role="alert" className="text-rose-700">{check.error}</p> : null}
      {check?.result ? (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5" aria-label="AI check result">
          {check.result.summary ? <p className="text-foreground">{check.result.summary}</p> : null}
          {check.result.signals.length ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-rose-700">
              {check.result.signals.map((s) => <li key={s}>{s}</li>)}
            </ul>
          ) : null}
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Checked against: idea intake{check.result.sources.length ? `, ${check.result.sources.join(', ')}` : ' (no documents linked)'}. Advisory — the decision stays with you.
          </p>
        </div>
      ) : null}
    </div>
  )
}
