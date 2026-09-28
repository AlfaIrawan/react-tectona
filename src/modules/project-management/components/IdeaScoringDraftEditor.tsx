import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Clock3, Gauge, Loader2, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createIdeaSectionRevision,
  listIdeaSectionRevisions,
  transitionIdeaSectionRevision,
  type IdeaSectionRevisionApi,
} from '@/lib/api/ideaBacklogApi'
import { draftIdeaScoring, type IdeaScoringDimensionKey, type IdeaScoringDraft } from '@/lib/api/tectonaAgentRuntimeApi'
import { IDEA_SECTION_REVISION_UPDATED_EVENT, dispatchIdeaSectionRevisionUpdated } from '@/lib/chat/ideaSectionRevisionFromChat'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { notifySectionReview, type SectionReviewNotifyContext } from '@/lib/notifications/notifySectionReview'
import { cn } from '@/lib/utils'

/** Same order, labels and weights as the Scoring framework (idea-backlog official_scoring_payload). */
export const SCORE_DRAFT_DIMENSIONS: Array<{ key: IdeaScoringDimensionKey; label: string; weight: string; hint: string }> = [
  { key: 'business_value', label: 'Business Value', weight: '30%', hint: '10 = large, clear business benefit' },
  { key: 'roi', label: 'ROI', weight: '30%', hint: '10 = measurable return well above cost' },
  { key: 'effort', label: 'Effort', weight: '20%', hint: '10 = very heavy delivery effort' },
  { key: 'risk', label: 'Risk', weight: '20%', hint: '10 = very high risk' },
]

type Scores = Record<IdeaScoringDimensionKey, { score: number; reason: string; change_reason?: string }>

/** Points away from the AI draft that the approver must comment on (idea-backlog MAJOR_SCORE_CHANGE). */
export const MAJOR_SCORE_CHANGE = 3

function hasProposedScores(revision: IdeaSectionRevisionApi): boolean {
  const content = revision.content_json as Record<string, unknown> | undefined
  return Boolean(content && typeof content.proposed_scores === 'object' && content.proposed_scores)
}

/** A scoring proposal waiting for review (so the checklist says so instead of offering a new draft). */
export function usePendingScoreProposal(ideaId: string): IdeaSectionRevisionApi | null {
  const [pending, setPending] = useState<IdeaSectionRevisionApi | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => {
      void listIdeaSectionRevisions(ideaId, 'scoring')
        .then((revisions) => {
          if (!alive) return
          setPending(revisions.find((r) => (r.status === 'proposed' || r.status === 'accepted') && hasProposedScores(r)) ?? null)
        })
        .catch(() => undefined)
    }
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.ideaId === ideaId && detail?.sectionKey === 'scoring') load()
    }
    load()
    window.addEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate)
    return () => { alive = false; window.removeEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate) }
  }, [ideaId])
  return pending
}

/**
 * "Score this idea": AI drafts the four scores with reasons, a person edits
 * them and saves them for review. The scores become official only when the
 * Scoring revision is approved in Version history (idea-backlog writes them then).
 */
export function IdeaScoringDraftEditor({
  ideaId, currentContent, notifyContext, onClose,
}: {
  ideaId: string
  currentContent: string
  notifyContext?: SectionReviewNotifyContext
  onClose: () => void
}) {
  const [draft, setDraft] = useState<IdeaScoringDraft | null>(null)
  const [values, setValues] = useState<Scores | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await draftIdeaScoring(ideaId)
      setDraft(result)
      setValues(structuredClone(result.scores))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI draft could not be generated.')
    } finally {
      setLoading(false)
    }
  }, [ideaId])

  useEffect(() => { void generate() }, [generate])

  // A score moved away from the AI draft needs a reason (idea-backlog refuses it otherwise).
  const changedFromAi = (key: IdeaScoringDimensionKey) => Boolean(draft && values && values[key].score !== draft.scores[key].score)
  const invalid = !values || SCORE_DRAFT_DIMENSIONS.some(({ key }) => {
    const item = values[key]
    return !Number.isInteger(item.score) || item.score < 1 || item.score > 10 || !item.reason.trim()
      || (changedFromAi(key) && !(item.change_reason ?? '').trim())
  })

  const save = async () => {
    if (!values || invalid || !draft) return
    setSaving(true)
    setError(null)
    try {
      const revisions = await listIdeaSectionRevisions(ideaId, 'scoring')
      const active = revisions.find((r) => r.status === 'approved') ?? null
      const created = await createIdeaSectionRevision(ideaId, 'scoring', {
        source: 'human',
        content_json: {
          proposed_scores: Object.fromEntries(SCORE_DRAFT_DIMENSIONS.map(({ key }) => [key, {
            score: values[key].score,
            reason: values[key].reason.trim(),
            ...(changedFromAi(key) ? { change_reason: (values[key].change_reason ?? '').trim() } : {}),
          }])),
          ai_scores: draft.scores,
        },
        base_revision_id: active?.id ?? null,
        original_ai_text: currentContent,
        // Always a second person for scores (idea-backlog enforces it on approval).
        require_checker: true,
        model_id: draft.model_id ?? null,
        evidence_json: [{ type: 'ai_suggestion', purpose: 'scoring_draft', sources: draft.sources }],
      })
      await transitionIdeaSectionRevision(ideaId, 'scoring', created.id, 'accept')
      notifySectionReview(notifyContext, {
        kind: 'submitted', sectionKey: 'scoring', sectionLabel: 'Scoring', revisionId: created.id,
        changedLabels: SCORE_DRAFT_DIMENSIONS.map(({ label }) => label),
      })
      dispatchIdeaSectionRevisionUpdated(ideaId, 'scoring')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The scores could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-background/80 p-3.5" aria-label="Score this idea">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Gauge className="h-4 w-4" aria-hidden /> Score this idea
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            AI draft from the intake and the idea&apos;s documents. Adjust it, then save it for review — the scores become official once
            another reviewer (not you, not the idea&apos;s owner) approves them. A score you change from the AI draft needs a reason.
          </p>
        </div>
        {draft && !loading ? (
          <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), 'gap-1.5 px-3')} disabled={saving} onClick={() => void generate()}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Redraft
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> AI is drafting the scores…
        </p>
      ) : null}

      {!loading && values ? (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {SCORE_DRAFT_DIMENSIONS.map(({ key, label, weight, hint }) => {
            const item = values[key]
            const aiItem = draft?.scores[key]
            const edited = Boolean(aiItem && (aiItem.score !== item.score || aiItem.reason !== item.reason))
            const delta = aiItem ? item.score - aiItem.score : 0
            const major = Math.abs(delta) >= MAJOR_SCORE_CHANGE
            return (
              <div key={key} className="rounded-lg border border-slate-200/80 bg-white/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="text-[11px] text-slate-500">Weight {weight} · {hint}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Input
                      type="number" min={1} max={10} step={1} inputMode="numeric"
                      aria-label={`${label} score`}
                      value={Number.isFinite(item.score) ? item.score : ''}
                      disabled={saving}
                      onChange={(e) => setValues((prev) => prev && ({ ...prev, [key]: { ...prev[key], score: Number(e.target.value) } }))}
                      className="h-10 w-16 rounded-lg px-2 text-center text-base font-semibold tabular-nums"
                    />
                    /10
                  </label>
                </div>
                <Textarea
                  aria-label={`${label} reason`}
                  value={item.reason}
                  maxLength={500}
                  disabled={saving}
                  onChange={(e) => setValues((prev) => prev && ({ ...prev, [key]: { ...prev[key], reason: e.target.value } }))}
                  className="mt-2 min-h-[72px] resize-y rounded-lg px-3 py-2 text-xs leading-5"
                />
                {changedFromAi(key) ? (
                  <div className="mt-2 space-y-1">
                    <p className={cn('text-[11px] font-semibold', major ? 'text-rose-700' : 'text-amber-700')}>
                      AI {aiItem?.score} → {item.score} ({delta > 0 ? '+' : ''}{delta}){major ? ' · Major change: the approver must comment' : ''}
                    </p>
                    <Textarea
                      aria-label={`Why ${label} differs from the AI draft`}
                      placeholder="Why does this score differ from the AI draft? Cite the evidence."
                      value={item.change_reason ?? ''}
                      maxLength={500}
                      disabled={saving}
                      onChange={(e) => setValues((prev) => prev && ({ ...prev, [key]: { ...prev[key], change_reason: e.target.value } }))}
                      className={cn('min-h-[56px] resize-y rounded-lg px-3 py-2 text-xs leading-5', !(item.change_reason ?? '').trim() && 'border-amber-300')}
                    />
                  </div>
                ) : null}
                <p className="mt-1 text-[10px] text-slate-400">{edited ? 'Edited from the AI draft' : 'AI draft'}</p>
              </div>
            )
          })}
        </div>
      ) : null}

      {!loading && draft?.missing_evidence.length ? (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Evidence that would firm up these scores</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {draft.missing_evidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {!loading && draft ? (
        <p className="text-[11px] text-slate-500">
          Sources: {draft.sources.length ? draft.sources.join(', ') : 'idea intake only (no documents linked to this idea)'}
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
        <p className="min-w-0 text-xs text-slate-500">Saved as pending approval by another reviewer.</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className={enterpriseSecondaryButtonClass()} disabled={saving} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden /> Cancel
          </Button>
          <Button type="button" className={registerServicePrimaryButtonClass()} disabled={saving || loading || invalid} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Save for review
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Checklist line for a scoring proposal that is waiting for approval. */
export function PendingScoreProposalNote() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <Clock3 className="h-3.5 w-3.5" aria-hidden /> Awaiting review in Version history
    </span>
  )
}

