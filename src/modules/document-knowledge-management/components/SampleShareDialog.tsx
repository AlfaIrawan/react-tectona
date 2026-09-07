import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SampleShareWorkspaceTarget } from '@/modules/document-knowledge-management/lib/samplesShare'

type SampleShareDialogProps = {
  title: string
  itemName: string
  targets: SampleShareWorkspaceTarget[]
  selectedIds: Set<string>
  busy: boolean
  onToggle: (workspaceId: string) => void
  onCancel: () => void
  onSave: () => void
}

export function SampleShareDialog({
  title,
  itemName,
  targets,
  selectedIds,
  busy,
  onToggle,
  onCancel,
  onSave,
}: SampleShareDialogProps) {
  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close Samples share dialog"
        disabled={busy}
        onClick={() => { if (!busy) onCancel() }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="samples-share-dialog-title"
        className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/25">
              <Globe className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id="samples-share-dialog-title" className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">
                Copy <span className="font-medium text-foreground">{itemName}</span> into Samples of other non-personal workspaces. Personal workspaces are excluded. Sensitive files are only copied if you select a workspace here.
              </p>
            </div>
          </div>
        </div>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto px-6 py-5">
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other non-personal workspaces in this organization are available.</p>
          ) : (
            targets.map((workspace) => (
              <label
                key={workspace.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-700"
                  checked={selectedIds.has(workspace.id)}
                  disabled={busy}
                  onChange={() => onToggle(workspace.id)}
                />
                <span className="font-medium text-foreground">{workspace.name}</span>
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border/70 px-6 py-4">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={busy || targets.length === 0} onClick={onSave}>
            {busy ? 'Sharing…' : 'Share and sync'}
          </Button>
        </div>
      </div>
    </div>
  )
}
