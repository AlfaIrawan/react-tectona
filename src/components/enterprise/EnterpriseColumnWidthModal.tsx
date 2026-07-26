import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Ruler, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'

export type EnterpriseColumnWidthModalProps = {
  open: boolean
  onClose: () => void
  onApply: (widthPx: number | null) => void
  columnLabel: string
  valuePx: string
  onValuePxChange: (value: string) => void
  minWidth?: number
  maxWidth?: number
  dialogTitleId?: string
}

/** Column width editor — matches enterprise delete dialog chrome (Document / Workspace Management). */
export function EnterpriseColumnWidthModal({
  open,
  onClose,
  onApply,
  columnLabel,
  valuePx,
  onValuePxChange,
  minWidth = 80,
  maxWidth = 520,
  dialogTitleId = 'enterprise-column-width-dialog-title',
}: EnterpriseColumnWidthModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  const submit = () => {
    const raw = valuePx.trim()
    if (!raw) {
      onApply(null)
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    const clamped = Math.max(minWidth, Math.min(maxWidth, Math.round(parsed)))
    onApply(clamped)
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close column width dialog"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-300">
              <Ruler className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id={dialogTitleId} className="text-base font-semibold tracking-tight text-foreground">
                Column width
              </h3>
              <p className="text-sm text-muted-foreground">
                Set column width in pixels (px). Leave empty to reset to auto.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Column
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{columnLabel}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <label htmlFor="enterprise-column-width-input" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Width (px)
            </label>
            <Input
              id="enterprise-column-width-input"
              type="number"
              inputMode="numeric"
              min={minWidth}
              max={maxWidth}
              placeholder={`e.g. ${Math.min(220, maxWidth)}`}
              value={valuePx}
              onChange={(e) => onValuePxChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                submit()
              }}
              className="mt-2 h-10"
              autoFocus
            />
          </div>

          <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Width guidance</div>
            <div className="mt-1">Allowed range: {minWidth}–{maxWidth} px.</div>
            <div>Empty value restores automatic column sizing.</div>
          </div>

          <p className="text-xs text-muted-foreground">
            Enterprise note: column width applies to the current Workspace Directory table view on this device session.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            onClick={onClose}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(enterpriseCyanGradientActionButtonClass(), 'min-w-0 basis-0 flex-1 justify-center')}
            onClick={submit}
          >
            <Ruler className="h-4 w-4 shrink-0" aria-hidden />
            Apply width
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
