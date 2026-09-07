import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SAMPLE_KIND_LABELS, type SampleDocumentKind } from '@/modules/document-knowledge-management/lib/sampleDocumentKind'
import type { OrgSampleKindReconcile } from '@/modules/document-knowledge-management/lib/reconcileOrgSampleKindVotes'

export type SampleKindConflictChoice =
  | { action: 'cancel' }
  | { action: 'unclassified' }
  | { action: 'kind'; kind: SampleDocumentKind; workspaceId: string }

type SampleKindConflictDialogProps = {
  fileName: string
  conflict: Extract<OrgSampleKindReconcile, { outcome: 'conflict' }>
  onChoose: (choice: SampleKindConflictChoice) => void
}

export function SampleKindConflictDialog({ fileName, conflict, onChoose }: SampleKindConflictDialogProps) {
  const homeVote = conflict.votes.find((vote) => vote.role === 'home')

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close sample kind confirmation"
        onClick={() => onChoose({ action: 'cancel' })}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-kind-conflict-title"
        className="relative z-[1401] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/25">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id="sample-kind-conflict-title" className="text-base font-semibold tracking-tight text-foreground">
                Samples disagree on document kind
              </h3>
              <p className="text-sm text-muted-foreground">
                Organization and another workspace classified this file differently. Choose which Samples library to follow.
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto px-6 py-5 text-sm">
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">File</p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{fileName}</p>
          </div>

          <ul className="space-y-2">
            {conflict.votes.filter((vote) => vote.hasGoldSet).map((vote) => (
              <li key={vote.workspaceId} className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                <div className="font-medium text-foreground">
                  {vote.workspaceName}
                  {vote.role === 'home' ? ' · Organization' : ''}
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  {vote.kind === 'unknown'
                    ? 'No clear match'
                    : SAMPLE_KIND_LABELS[vote.kind]}
                  {vote.confidence > 0 ? ` (${vote.confidence.toFixed(2)})` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/70 px-6 py-4 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onChoose({ action: 'cancel' })}>
            Cancel upload
          </Button>
          <Button type="button" variant="outline" onClick={() => onChoose({ action: 'unclassified' })}>
            Leave unclassified
          </Button>
          {conflict.choices.map((choice) => {
            const preferHome = homeVote && choice.workspaceIds.includes(homeVote.workspaceId)
            const workspaceId = preferHome ? homeVote.workspaceId : (choice.workspaceIds[0] ?? '')
            const label = preferHome
              ? `Use Organization (${SAMPLE_KIND_LABELS[choice.kind]})`
              : `Use ${choice.workspaceNames[0] ?? 'workspace'} (${SAMPLE_KIND_LABELS[choice.kind]})`
            return (
              <Button
                key={choice.kind}
                type="button"
                variant={preferHome ? 'default' : 'outline'}
                onClick={() => onChoose({ action: 'kind', kind: choice.kind, workspaceId })}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
