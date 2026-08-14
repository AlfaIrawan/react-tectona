import { MonitorSmartphone } from 'lucide-react'
import { EnterpriseActionConfirmModal } from '@/components/enterprise/EnterpriseActionConfirmModal'
import { formatActiveSessionStartedAt, type ActiveSessionInfo } from '@/lib/sessionConflict'

export type SessionConflictModalProps = {
  open: boolean
  busy?: boolean
  /** Shown inside the modal when "Use this device" fails (OAuth retry, network, etc.). */
  actionError?: string | null
  /** Account being signed in — conflict is for this user, not whoever is in another tab. */
  accountEmail?: string | null
  activeSession?: ActiveSessionInfo | null
  onUseNewSession: () => void
  onKeepExisting: () => void
}

export function SessionConflictModal({
  open,
  busy = false,
  actionError,
  accountEmail,
  activeSession,
  onUseNewSession,
  onKeepExisting,
}: SessionConflictModalProps) {
  const formattedStartedAt = formatActiveSessionStartedAt(activeSession?.started_at)
  const device = activeSession?.device?.trim() || 'Unknown device'
  const browser = activeSession?.browser?.trim() || 'Unknown browser'
  const location = activeSession?.location?.trim() || 'Unknown location'
  const accountLabel = accountEmail?.trim() || null

  return (
    <EnterpriseActionConfirmModal
      open={open}
      onClose={onKeepExisting}
      onConfirm={onUseNewSession}
      busy={busy}
      title="Active session detected"
      description={
        accountLabel
          ? `${accountLabel} is already signed in on another device or browser. Choose how to continue.`
          : 'This account is already signed in on another device or browser. Choose how to continue.'
      }
      entityLabel="Account"
      entityValue={
        accountLabel
          ? accountLabel
          : formattedStartedAt
            ? `Started ${formattedStartedAt}`
            : 'Another device or browser'
      }
      bodyContent={
        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2.5">
            <div className="font-medium text-foreground">Session details</div>
            <div className="mt-2 space-y-1">
              <div>
                <span className="text-muted-foreground">Device:</span>{' '}
                <span className="font-medium text-foreground">{device}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Browser:</span>{' '}
                <span className="font-medium text-foreground">{browser}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium text-foreground">{location}</span>
              </div>
              {formattedStartedAt ? (
                <div>
                  <span className="text-muted-foreground">Started:</span>{' '}
                  <span className="font-medium text-foreground">{formattedStartedAt}</span>
                </div>
              ) : null}
            </div>
          </div>
          <p className="leading-relaxed">
            If you continue here, the other session will be signed out automatically. If you keep the existing
            session, this sign-in attempt will be cancelled.
          </p>
        </div>
      }
      footerExtra={
        actionError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {actionError}
          </p>
        ) : null
      }
      enterpriseNote="Security note: only one active session is allowed per account."
      confirmLabel="Use this device"
      confirmBusyLabel="Signing in…"
      cancelLabel="Keep existing session"
      dialogTitleId="session-conflict-dialog-title"
      icon={MonitorSmartphone}
      iconContainerClassName="bg-amber-500/12 text-amber-800 ring-amber-500/25 dark:text-amber-200"
    />
  )
}
