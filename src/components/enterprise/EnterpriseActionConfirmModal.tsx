import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'

export type EnterpriseActionConfirmModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  busy?: boolean
  title: string
  description: ReactNode
  entityLabel: string
  entityValue: string
  enterpriseNote?: string
  bodyContent?: ReactNode
  footerExtra?: ReactNode
  confirmLabel: string
  confirmBusyLabel?: string
  cancelLabel?: string
  disableConfirm?: boolean
  dialogTitleId?: string
  icon?: LucideIcon
  iconContainerClassName?: string
}

/** Enterprise action confirmation — same shell as EnterpriseDeleteConfirmModal, primary confirm. */
export function EnterpriseActionConfirmModal({
  open,
  onClose,
  onConfirm,
  busy = false,
  title,
  description,
  entityLabel,
  entityValue,
  enterpriseNote,
  bodyContent,
  footerExtra,
  confirmLabel,
  confirmBusyLabel,
  cancelLabel = 'Cancel',
  disableConfirm = false,
  dialogTitleId = 'enterprise-action-dialog-title',
  icon: Icon = Check,
  iconContainerClassName = 'bg-primary/12 text-primary ring-primary/25',
}: EnterpriseActionConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, busy, onClose])

  if (!open || typeof document === 'undefined') return null

  const confirmDisabled = busy || disableConfirm

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close confirmation"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                iconContainerClassName,
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id={dialogTitleId} className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {entityLabel}
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{entityValue}</p>
          </div>

          {bodyContent ? (
            <div className="rounded-xl border border-border bg-background/70 px-4 py-3">{bodyContent}</div>
          ) : null}

          {footerExtra}

          {enterpriseNote ? (
            <p className="text-xs text-muted-foreground">{enterpriseNote}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            disabled={confirmDisabled}
            onClick={() => void onConfirm()}
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {busy ? (confirmBusyLabel ?? 'Processing...') : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
