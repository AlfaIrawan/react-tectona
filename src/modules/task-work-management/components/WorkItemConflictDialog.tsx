import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { GitMerge, Laptop, Loader2, Server, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pushGlobalToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  formatConflictValue,
  getConflictFields,
  resolveWorkSyncConflict,
} from '@/lib/work/offline/workOfflineClient'
import {
  WORK_CONFLICT_FIELD_LABELS,
  type WorkConflictFieldChoice,
  type WorkSyncConflict,
} from '@/lib/work/offline/types'
import type { WorkItemApiModel } from '@/lib/api/workApi'
import { mapApiWorkItemToPage } from '@/lib/api/workApi'

type WorkItemConflictDialogProps = {
  conflict: WorkSyncConflict | null
  onResolved: (updated: WorkItemApiModel | null) => void
}

const DIALOG_TITLE_ID = 'work-sync-conflict-dialog-title'

export function WorkItemConflictDialog({ conflict, onResolved }: WorkItemConflictDialogProps) {
  const [mode, setMode] = useState<'choose' | 'merge'>('choose')
  const [fieldChoices, setFieldChoices] = useState<Record<string, WorkConflictFieldChoice>>({})
  const [saving, setSaving] = useState(false)
  const [savingStrategy, setSavingStrategy] = useState<'theirs' | 'ours' | 'merge' | null>(null)

  const fields = useMemo(() => (conflict ? getConflictFields(conflict) : []), [conflict])
  const open = Boolean(conflict)

  useEffect(() => {
    if (!conflict) return
    setMode('choose')
    setSaving(false)
    setSavingStrategy(null)
    const initial: Record<string, WorkConflictFieldChoice> = {}
    for (const field of getConflictFields(conflict)) {
      initial[field] = 'local'
    }
    setFieldChoices(initial)
  }, [conflict])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return
      event.preventDefault()
      event.stopPropagation()
      onResolved(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, saving, onResolved])

  if (!conflict || typeof document === 'undefined') return null

  async function applyResolution(
    strategy: 'theirs' | 'ours' | 'merge',
    mergeFields?: Record<string, WorkConflictFieldChoice>,
  ) {
    setSaving(true)
    setSavingStrategy(strategy)
    try {
      const updated = await resolveWorkSyncConflict(
        conflict!.id,
        strategy === 'theirs'
          ? { strategy: 'theirs' }
          : strategy === 'ours'
            ? { strategy: 'ours' }
            : { strategy: 'merge', fields: mergeFields ?? fieldChoices },
      )
      onResolved(updated)
      pushGlobalToast({
        variant: 'success',
        title: 'Sync conflict resolved',
        description: `${conflict!.businessKey} is synced with the server.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not apply your choice.'
      pushGlobalToast({
        variant: 'error',
        title: 'Sync conflict failed',
        description: message,
      })
    } finally {
      setSaving(false)
      setSavingStrategy(null)
    }
  }

  function actionCardBusy(strategy: 'theirs' | 'ours' | 'merge'): boolean {
    return saving && savingStrategy === strategy
  }

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close sync conflict dialog"
        disabled={saving}
        onClick={() => {
          if (!saving) onResolved(null)
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
        className="relative z-[1401] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/25">
              <GitMerge className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id={DIALOG_TITLE_ID} className="text-base font-semibold tracking-tight text-foreground">
                Sync conflict
              </h3>
              <p className="text-sm text-muted-foreground">
                {conflict.businessKey} — {conflict.localItem.title} was changed locally and on the server. Choose how
                to merge, like resolving a Git conflict.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Work item</p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{conflict.localItem.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">ID: {conflict.businessKey}</p>
          </div>

          {mode === 'choose' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  className={cn(
                    'rounded-xl border border-border bg-background/70 px-4 py-3 text-left transition hover:border-blue-300/80 hover:bg-background',
                    actionCardBusy('theirs') && 'border-blue-400 ring-2 ring-blue-200/60',
                  )}
                  onClick={() => void applyResolution('theirs')}
                  disabled={saving}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                    {actionCardBusy('theirs') ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Server className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    {actionCardBusy('theirs') ? 'Applying…' : 'Accept incoming'}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Keep server version (v{conflict.serverItem.version ?? '?'}) and discard your pending changes.
                  </p>
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-xl border border-border bg-background/70 px-4 py-3 text-left transition hover:border-emerald-300/80 hover:bg-background',
                    actionCardBusy('ours') && 'border-emerald-400 ring-2 ring-emerald-200/60',
                  )}
                  onClick={() => void applyResolution('ours')}
                  disabled={saving}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    {actionCardBusy('ours') ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Laptop className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    {actionCardBusy('ours') ? 'Applying…' : 'Accept yours'}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Force your local edits on top of the latest server record.
                  </p>
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-border bg-background/70 px-4 py-3 text-left transition hover:border-amber-300/80 hover:bg-background"
                  onClick={() => setMode('merge')}
                  disabled={saving || fields.length === 0}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <GitMerge className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    Merge manually
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Pick field-by-field whether to keep yours or incoming values.
                  </p>
                </button>
              </div>

              {fields.length > 0 ? (
                <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Conflict summary</div>
                  <div className="mt-2 overflow-hidden rounded-lg border border-border/80">
                    <div className="grid grid-cols-3 border-b border-border/80 bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Field</span>
                      <span>Yours</span>
                      <span>Incoming</span>
                    </div>
                    {fields.map((field) => (
                      <div
                        key={field}
                        className="grid grid-cols-3 gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-b-0"
                      >
                        <span className="font-medium text-foreground">
                          {WORK_CONFLICT_FIELD_LABELS[field] ?? field}
                        </span>
                        <span className="truncate text-emerald-700">
                          {formatConflictValue((conflict.localItem as unknown as Record<string, unknown>)[field])}
                        </span>
                        <span className="truncate text-blue-700">
                          {formatConflictValue((conflict.serverItem as unknown as Record<string, unknown>)[field])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Enterprise note: unresolved conflicts block outbox sync for this item until you choose a resolution.
              </p>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Field-by-field merge</div>
                <div className="mt-3 space-y-3">
                  {fields.map((field) => (
                    <div key={field}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {WORK_CONFLICT_FIELD_LABELS[field] ?? field}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {(['local', 'remote'] as const).map((choice) => {
                          const item = choice === 'local' ? conflict.localItem : conflict.serverItem
                          const active = fieldChoices[field] === choice
                          return (
                            <button
                              key={choice}
                              type="button"
                              className={cn(
                                'rounded-lg border px-3 py-2 text-left text-sm transition',
                                active
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                  : 'border-border bg-background hover:bg-muted/30',
                              )}
                              onClick={() =>
                                setFieldChoices((previous) => ({
                                  ...previous,
                                  [field]: choice,
                                }))
                              }
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {choice === 'local' ? 'Yours' : 'Incoming'}
                              </div>
                              <div className="mt-1 truncate font-medium text-foreground">
                                {formatConflictValue((item as unknown as Record<string, unknown>)[field])}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          {mode === 'merge' ? (
            <>
              <Button
                type="button"
                variant="outline"
                className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                disabled={saving}
                onClick={() => setMode('choose')}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                disabled={saving}
                onClick={() => void applyResolution('merge', fieldChoices)}
              >
                <GitMerge className="h-4 w-4 shrink-0" aria-hidden />
                {saving ? 'Applying merge…' : 'Apply merge'}
              </Button>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <p className="hidden text-xs text-muted-foreground sm:block">
                Choose an action above to continue sync.
              </p>
              <Button
                type="button"
                variant="outline"
                className={cn(enterpriseSecondaryButtonClass(), 'ml-auto min-w-[8rem] justify-center gap-2 sm:min-w-0 sm:flex-1')}
                disabled={saving}
                onClick={() => onResolved(null)}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function mapResolvedConflictToWorkItem(updated: WorkItemApiModel | null) {
  return updated ? (mapApiWorkItemToPage(updated) as ReturnType<typeof mapApiWorkItemToPage>) : null
}
