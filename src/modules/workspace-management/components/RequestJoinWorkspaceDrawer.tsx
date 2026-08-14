import { useEffect, useState } from 'react'
import { Loader2, LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSession } from '@/auth/authService'
import { isValidSlugFormat } from '@/lib/onboardingFeature'
import { resolveSlug } from '@/lib/api/workspaceOrgApi'
import {
  submitAccessRequest,
  TECTONA_WAC_APP_ID,
} from '@/lib/api/workspaceAccessControlApi'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'

export type RequestJoinWorkspaceDrawerProps = {
  open: boolean
  onClose: () => void
  onSubmitted?: (info: { workspaceId: string; slug: string; displayName: string }) => void
}

/**
 * Post-signup “Request to join” — same slug lookup + access-request flow as onboarding.
 * Opened from Workspace Members toolbar (beside Invite Member); drawer mounted in AppLayout.
 */
export function RequestJoinWorkspaceDrawer({
  open,
  onClose,
  onSubmitted,
}: RequestJoinWorkspaceDrawerProps) {
  const [slug, setSlug] = useState('')
  const [message, setMessage] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [resolved, setResolved] = useState<{
    workspaceId: string
    displayName: string
    tenantMode: string
  } | null>(null)

  const normalized = slug.trim().toLowerCase()

  useEffect(() => {
    if (open) return
    setSlug('')
    setMessage('')
    setLookupError('')
    setSubmitError('')
    setResolved(null)
    setLookupLoading(false)
    setSubmitting(false)
  }, [open])

  const handleLookup = async () => {
    setLookupError('')
    setSubmitError('')
    setResolved(null)
    if (!isValidSlugFormat(normalized)) {
      setLookupError('Invalid slug format.')
      return
    }
    setLookupLoading(true)
    try {
      const data = await resolveSlug(normalized)
      setResolved({
        workspaceId: data.workspace_id,
        displayName: data.display_name,
        tenantMode: data.tenant_mode,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Workspace not found.'
      if (/404|not found/i.test(msg)) {
        setLookupError('Workspace not found for that slug.')
      } else {
        setLookupError(msg)
      }
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!resolved) return
    const session = getSession()
    if (!session?.user?.id) {
      setSubmitError('You must be signed in to request access.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitAccessRequest(
        TECTONA_WAC_APP_ID,
        {
          workspace_id: resolved.workspaceId,
          workspace_slug: normalized,
          message: message.trim() || undefined,
        },
        {
          actorId: session.user.id,
          idempotencyKey:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `join-${Date.now().toString(36)}`,
        },
      )
      onSubmitted?.({
        workspaceId: resolved.workspaceId,
        slug: normalized,
        displayName: resolved.displayName,
      })
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit join request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-[1100] flex h-screen w-[420px] max-w-[92vw] flex-col transform border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl transition-all duration-300',
        open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0',
      )}
      style={{ boxShadow: '0 0 60px rgba(0,0,0,0.3), inset 1px 0 0 rgba(255,255,255,0.1)' }}
      role="dialog"
      aria-labelledby="request-join-workspace-title"
      aria-hidden={!open}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LogIn className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
            <h2 id="request-join-workspace-title" className="text-base font-semibold text-foreground">
              Request to Join Workspace
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ask an admin for access using the workspace slug or directory code (e.g. mjw-bb4r).
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {submitError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="request-join-slug">Workspace slug or code</Label>
          <div className="flex gap-2">
            <Input
              id="request-join-slug"
              className="min-w-0 flex-1"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase())
                setResolved(null)
                setLookupError('')
              }}
              placeholder="e.g. mufg-jpn-ws"
              disabled={submitting}
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleLookup()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), 'shrink-0')}
              onClick={() => void handleLookup()}
              disabled={lookupLoading || submitting || !normalized}
            >
              {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Search'}
            </Button>
          </div>
          {lookupError ? (
            <p className="text-xs text-destructive" role="alert">
              {lookupError}
            </p>
          ) : null}
        </div>

        {resolved ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">{resolved.displayName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Slug: <code className="font-mono">{normalized}</code>
              {resolved.tenantMode ? ` · ${resolved.tenantMode}` : ''}
            </p>
          </div>
        ) : null}

        {resolved ? (
          <div className="space-y-2">
            <Label htmlFor="request-join-message">Message to admin (optional)</Label>
            <Input
              id="request-join-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I'm joining the delivery team"
              disabled={submitting}
            />
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'flex-1 justify-center')}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(registerServicePrimaryButtonClass(), 'flex-1 justify-center gap-2')}
            disabled={!resolved || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {submitting ? 'Sending…' : 'Ask for access'}
          </Button>
        </div>
      </div>
    </div>
  )
}
