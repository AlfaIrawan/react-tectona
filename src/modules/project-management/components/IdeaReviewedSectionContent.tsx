import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { getActiveIdeaSectionRevision, type IdeaSectionKey, type IdeaSectionRevisionApi } from '@/lib/api/ideaBacklogApi'
import { IDEA_SECTION_REVISION_UPDATED_EVENT } from '@/lib/chat/ideaSectionRevisionFromChat'
import { Button } from '@/components/ui/button'
import { reviewerDisplayName, type ReviewerNameResolver } from '@/modules/project-management/lib/reviewerDisplayName'

// Sections whose rich view carries official figures. Their analysis stays
// visible even under a human narrative, so a narrative edit can never tuck the
// official scores away behind a collapsed panel.
const OFFICIAL_FIGURE_SECTIONS = new Set<IdeaSectionKey>(['scoring', 'impact'])

// True only under the approved scoring narrative, so the score cards below
// can drop the title, brief, action, and commentary that the narrative already shows.
const ScoringNarrativeLeadsContext = createContext(false)

export function ScoringNarrativeEcho({ children }: { children: ReactNode }) {
  const leads = useContext(ScoringNarrativeLeadsContext)
  if (leads) return null
  return <>{children}</>
}

type ReviewMeta = { original_ai_text?: string; ai_text_at_edit?: string }

type ScoringNarrative = {
  portfolio: string | null
  action: string | null
  thesis: string[]
}

// Approved scoring text is four blocks joined by blank lines: portfolio title,
// executive brief, "Recommended action: …", then the value-thesis commentary.
function parseScoringNarrative(text: string): ScoringNarrative | null {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  let portfolio: string | null = null
  let action: string | null = null
  const thesis: string[] = []
  for (const block of blocks) {
    const portfolioMatch = block.match(/^(?:Analisis\s+Portfolio|Portfolio)\s*:\s*(.+)$/is)
    if (portfolioMatch && !portfolio) {
      portfolio = portfolioMatch[1].trim()
      continue
    }
    const actionMatch = block.match(/^Recommended action\s*:\s*(.+)$/is)
    if (actionMatch && !action) {
      action = actionMatch[1].trim()
      continue
    }
    thesis.push(block)
  }
  if (!portfolio && !action) return null
  return { portfolio, action, thesis }
}

function ScoringNarrativeView({ narrative }: { narrative: ScoringNarrative }) {
  return (
    <div className="space-y-4">
      {narrative.portfolio ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Portfolio</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{narrative.portfolio}</p>
        </div>
      ) : null}
      {narrative.thesis.length ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tesis</p>
          <div className="mt-1 space-y-2 text-sm leading-6 text-slate-700">
            {narrative.thesis.map((paragraph, index) => (
              <p key={index} className="whitespace-pre-wrap">{paragraph}</p>
            ))}
          </div>
        </div>
      ) : null}
      {narrative.action ? (
        <div className="border-l-2 border-slate-900 pl-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommended action</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{narrative.action}</p>
        </div>
      ) : null}
    </div>
  )
}

export function IdeaReviewedSectionContent({ ideaId, sectionKey, currentContent, userId, userName, resolveName, children, keepOriginal = false }: {
  ideaId: string; sectionKey: IdeaSectionKey; currentContent: string
  userId?: string | null; userName?: string | null; resolveName?: ReviewerNameResolver
  children?: ReactNode; keepOriginal?: boolean
}) {
  const [revision, setRevision] = useState<IdeaSectionRevisionApi | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  // Reset only when the section itself changes. A change in currentContent (a
  // summary refresh streaming in, say) refetches in place without clearing, so
  // the section never blanks out to a loading line mid-refresh.
  useEffect(() => {
    setRevision(null)
    setLoaded(false)
    setLoadFailed(false)
    setShowOriginal(false)
  }, [ideaId, sectionKey])

  useEffect(() => {
    let alive = true
    let generation = 0
    const refresh = () => {
      const request = ++generation
      void getActiveIdeaSectionRevision(ideaId, sectionKey)
        .then((value) => { if (alive && request === generation) { setRevision(value); setLoadFailed(false) } })
        .catch(() => { if (alive && request === generation) setLoadFailed(true) })
        .finally(() => { if (alive && request === generation) setLoaded(true) })
    }
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.ideaId === ideaId && detail?.sectionKey === sectionKey) refresh()
    }
    refresh()
    window.addEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate)
    return () => { alive = false; window.removeEventListener(IDEA_SECTION_REVISION_UPDATED_EVENT, onUpdate) }
  }, [ideaId, sectionKey, currentContent])

  // Until an approved revision is known — still loading, none exists, or the
  // lookup failed — the AI analysis is what the user sees. A failed lookup is
  // flagged but never hides the section: the AI content is still valid context.
  if (!loaded || !revision || revision.status !== 'approved') {
    return <>
      {loadFailed ? (
        <p role="status" className="px-4 pt-3 text-xs text-amber-700">
          The approved version could not be loaded — showing the AI analysis.
        </p>
      ) : null}
      {children}
    </>
  }

  const review = (revision.content_json._review ?? {}) as ReviewMeta
  const approvedText = String(revision.content_json.text || '')
  const displayName = (id: string) => reviewerDisplayName(id, { userId, userName, resolve: resolveName })
  // "Approved by" must name whoever approved, not whoever created the row: AI
  // revisions are created by the summary pipeline, so the author is never the
  // approver. Under maker-checker the two are different people by design.
  const author = displayName(revision.author_id)
  const approver = displayName(revision.approved_by || revision.author_id)
  const approvedOn = new Date(revision.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // Approving the AI output as-is is a status change, not new content. The
  // revision stores a flattened copy of the section, so rendering it would swap
  // the rich view (cards, charts, the official scores) for plain text. Keep the
  // rich view and mark it approved. ai_text_at_edit is the section content at
  // the moment of approval; when it still matches, the approved text IS what is
  // on screen.
  const approvedAsShown = revision.source === 'ai'
    && (review.ai_text_at_edit ?? '').trim() === currentContent.trim()
  // Inline field edits are applied inside the rich view itself (each edited card
  // shows the approved wording and its editor), so the view stays as it is.
  // Approved scores ("Score this idea") are the official scores the Scoring
  // cards already show, so their text would only repeat them above the cards.
  const fields = revision.content_json.fields
  const scores = (revision.content_json as Record<string, unknown>).proposed_scores
  const inlineEdited = Boolean(fields && typeof fields === 'object') || Boolean(scores && typeof scores === 'object')
  // Who approved and how many cards changed is shown once, in the section's
  // review toolbar (IdeaSectionReviewWorkspace), not as a line above the cards.
  if (approvedAsShown || inlineEdited || !approvedText.trim()) {
    return <>{children}</>
  }

  // A human edit — or an approved AI version that differs from the current AI
  // output — is the authoritative narrative, so it leads.
  const keepFiguresVisible = OFFICIAL_FIGURE_SECTIONS.has(sectionKey)
  const narrativeText = showOriginal ? review.original_ai_text || currentContent : approvedText
  const scoringNarrative = sectionKey === 'scoring' ? parseScoringNarrative(narrativeText) : null
  const versionToggle = (
    <Button
      variant="link"
      size="sm"
      className="h-auto px-0 text-xs font-normal text-muted-foreground"
      aria-pressed={showOriginal}
      onClick={() => setShowOriginal(!showOriginal)}
    >
      {showOriginal ? 'Show approved version' : 'Show original AI version'}
    </Button>
  )
  return <>
    <section className="space-y-3 border-b border-border px-4 py-4" aria-label="Versi section approved">
      {sectionKey === 'scoring' ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-emerald-700">
            {revision.source === 'human'
              ? <>Edited by {author}{approver !== author ? <> · approved by {approver}</> : null}</>
              : <>AI version approved by {approver}</>} · {approvedOn}
          </span>
          {versionToggle}
        </div>
      )}
      {scoringNarrative ? (
        <ScoringNarrativeView narrative={scoringNarrative} />
      ) : (
        <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap text-foreground">
          <ReactMarkdown>{narrativeText}</ReactMarkdown>
        </div>
      )}
      {sectionKey === 'scoring' ? versionToggle : null}
    </section>
    {children && keepFiguresVisible ? (
      <div className="pt-2">
        <p className="px-4 pb-1 text-xs font-medium text-muted-foreground">
          {sectionKey === 'scoring' ? 'Official scores' : 'AI analysis & official scores'}
        </p>
        <ScoringNarrativeLeadsContext.Provider value={sectionKey === 'scoring'}>
          {children}
        </ScoringNarrativeLeadsContext.Provider>
      </div>
    ) : children && keepOriginal ? (
      <details className="mx-4 mb-4 rounded-lg border border-border bg-muted/20">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">Show AI analysis and other section data</summary>
        <div className="border-t border-border p-3">{children}</div>
      </details>
    ) : null}
  </>
}
