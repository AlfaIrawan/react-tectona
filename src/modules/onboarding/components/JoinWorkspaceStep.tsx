import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { isValidSlugFormat } from '@/lib/onboardingFeature'
import { resolveSlug } from '@/lib/api/workspaceOrgApi'
import { authCardButtonInlineClass, authCardInputClass } from '@/lib/authUiClasses'

type JoinWorkspaceStepProps = {
  onBack: () => void
  onSubmit: (input: {
    workspaceId: string
    slug: string
    displayName: string
    message?: string
  }) => Promise<void>
  submitting: boolean
  error: string
  organizationHint?: string
}

export function JoinWorkspaceStep({ onBack, onSubmit, submitting, error, organizationHint }: JoinWorkspaceStepProps) {
  const [slug, setSlug] = useState('')
  const [message, setMessage] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [resolved, setResolved] = useState<{
    workspaceId: string
    displayName: string
    tenantMode: string
  } | null>(null)

  const normalized = slug.trim().toLowerCase()

  const handleLookup = async () => {
    setLookupError('')
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
        setLookupError('Organization is not registered or slug was not found.')
      } else {
        setLookupError(msg)
      }
    } finally {
      setLookupLoading(false)
    }
  }

  const orgNotFound =
    lookupError.includes('not registered') || lookupError.includes('not found')

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold">Ask to join a workspace</h2>
        <p className="text-sm text-muted-foreground">
          {organizationHint
            ? `Type the short workspace name (slug) for ${organizationHint}, or another workspace your admin shared with you.`
            : 'Type the short workspace name (slug) your admin shared with you.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="join-slug">Short workspace name (slug)</Label>
          <div className="flex gap-2">
            <Input
              id="join-slug"
              className={cn(authCardInputClass, 'min-w-0 flex-1')}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase())
                setResolved(null)
                setLookupError('')
              }}
              placeholder="e.g. adira-pmo"
              disabled={submitting}
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              className={cn(authCardButtonInlineClass, 'shrink-0 flex-none px-4')}
              onClick={() => void handleLookup()}
              disabled={lookupLoading || submitting}
            >
              {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Search'}
            </Button>
          </div>
          {lookupError && !orgNotFound && (
            <p className="text-xs text-destructive" role="alert">
              {lookupError}
            </p>
          )}
        </div>

        {orgNotFound && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">Organization not registered</p>
            <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
              Contact your organization administrator or wait for an official invitation.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" disabled>
              Register organization — Coming soon (P1)
            </Button>
          </div>
        )}

        {resolved && (
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium">{resolved.displayName}</p>
            <p className="text-muted-foreground">
              Slug: <code className="font-mono">{normalized}</code> · Mode: {resolved.tenantMode}
            </p>
          </div>
        )}

        {resolved && (
          <div className="space-y-2">
            <Label htmlFor="join-message">Message to admin (optional)</Label>
            <Input
              id="join-message"
              className={authCardInputClass}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I'm from the PMO team"
              disabled={submitting}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className={authCardButtonInlineClass} onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button
          type="button"
          className={authCardButtonInlineClass}
          disabled={!resolved || submitting}
          onClick={() =>
            void onSubmit({
              workspaceId: resolved!.workspaceId,
              slug: normalized,
              displayName: resolved!.displayName,
              message: message.trim() || undefined,
            })
          }
        >
          {submitting ? 'Sending…' : 'Ask for access'}
        </Button>
      </div>
    </div>
  )
}
