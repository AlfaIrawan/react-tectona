import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { suggestSlugFromName } from '@/lib/onboardingFeature'
import { buildPersonalWorkspaceSuggestions } from '@/lib/personalWorkspaceSuggestions'
import { useSlugAvailability } from '@/modules/onboarding/hooks/useSlugAvailability'
import { usePersonalWorkspaceSuggestions } from '@/modules/onboarding/hooks/usePersonalWorkspaceSuggestions'
import { authCardButtonClass, authCardButtonInlineClass, authCardInputClass } from '@/lib/authUiClasses'

type CreatePersonalWorkspaceStepProps = {
  onBack?: () => void
  onSubmit: (input: { displayName: string; slug: string }) => Promise<void>
  submitting: boolean
  error: string
  email?: string
  title?: string
  description?: string
  submitLabel?: string
  required?: boolean
  onSkip?: () => void
  skipLabel?: string
}

export function CreatePersonalWorkspaceStep({
  onBack,
  onSubmit,
  submitting,
  error,
  email,
  title = 'Create a personal workspace',
  description = 'Personal workspaces include the Workspace module for self-management, plus project delivery modules.',
  submitLabel = 'Create workspace',
  required = false,
  onSkip,
  skipLabel = 'Skip for now',
}: CreatePersonalWorkspaceStepProps) {
  const initialCandidate = useMemo(
    () => (email ? buildPersonalWorkspaceSuggestions(email)[0] : null),
    [email],
  )
  const [displayName, setDisplayName] = useState(initialCandidate?.displayName ?? '')
  const [slug, setSlug] = useState('')
  const [displayNameTouched, setDisplayNameTouched] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const appliedRecommendationKeyRef = useRef<string | null>(null)
  const {
    visibleSuggestions,
    recommended,
    loading: suggestionsLoading,
    refresh,
    canRefresh,
    hasCheckErrors,
  } = usePersonalWorkspaceSuggestions(email ?? '')

  const recommendedSlug = recommended?.slug ?? ''
  const recommendedDisplayName = recommended?.displayName ?? ''

  useEffect(() => {
    appliedRecommendationKeyRef.current = null
  }, [email])

  useEffect(() => {
    if (displayNameTouched || slugTouched || !recommendedSlug) return
    const key = `${recommendedSlug}:${recommendedDisplayName}`
    if (appliedRecommendationKeyRef.current === key) return
    appliedRecommendationKeyRef.current = key
    setDisplayName(recommendedDisplayName)
    setSlug(recommendedSlug)
  }, [displayNameTouched, recommendedDisplayName, recommendedSlug, slugTouched])

  const availability = useSlugAvailability(slug)
  const submitSaysSlugTaken = /slug already taken|already in use|slug unavailable/i.test(error)
  const showAvailable =
    availability.formatValid
    && !availability.loading
    && availability.available
    && !submitSaysSlugTaken
  const canSubmit =
    displayName.trim().length >= 2
    && availability.formatValid
    && availability.available
    && !availability.loading
    && !submitting
    && !submitSaysSlugTaken

  const applySuggestion = (display: string, nextSlug: string) => {
    setDisplayName(display)
    setSlug(nextSlug)
    setDisplayNameTouched(true)
    setSlugTouched(true)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold">
          {title}
          {required ? ' (required)' : ''}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {email && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Suggested names</Label>
            {canRefresh && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={submitting || suggestionsLoading}
                onClick={refresh}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', suggestionsLoading && 'animate-spin')} aria-hidden />
                More options
              </Button>
            )}
          </div>
          {suggestionsLoading && visibleSuggestions.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Finding available names…
            </p>
          ) : visibleSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleSuggestions.map((item) => {
                const isSelected = slug === item.slug && displayName === item.displayName
                return (
                  <button
                    key={item.slug}
                    type="button"
                    disabled={submitting}
                    onClick={() => applySuggestion(item.displayName, item.slug)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted/60',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground',
                    )}
                  >
                    {item.displayName}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {hasCheckErrors
                ? 'Could not verify suggested names (workspace-org may be unavailable). Enter a custom name below.'
                : 'No suggested names are free — enter a custom workspace name below.'}
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            className={authCardInputClass}
            value={displayName}
            onChange={(e) => {
              setDisplayNameTouched(true)
              const next = e.target.value
              setDisplayName(next)
              if (!slugTouched) {
                setSlug(suggestSlugFromName(next))
              }
            }}
            placeholder="e.g. Alfa Irawan WS"
            disabled={submitting}
            autoComplete="organization"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-url">Workspace address</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/t/</span>
            <Input
              id="workspace-url"
              className={authCardInputClass}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase())
              }}
              placeholder="alfa-irawan-ws"
              disabled={submitting}
              spellCheck={false}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Short path used in your workspace URL. Use lowercase letters, numbers, and hyphens.
          </p>
          {slug && !availability.formatValid && (
            <p className="text-xs text-destructive">
              Use 3–63 characters: lowercase letters, numbers, and hyphens only.
            </p>
          )}
          {availability.formatValid && availability.loading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Checking availability…
            </p>
          )}
          {availability.formatValid && !availability.loading && !availability.available && (
            <p className="text-xs text-destructive">
              {availability.reason === 'reserved'
                ? 'This address is reserved. Choose another.'
                : 'This address is already in use. Choose another.'}
            </p>
          )}
          {showAvailable && (
            <p className="text-xs text-green-600 dark:text-green-400">This address is available.</p>
          )}
          {submitSaysSlugTaken && (
            <p className="text-xs text-destructive">
              This address is already in use. Pick another or refresh suggestions.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          {onBack ? (
            <Button type="button" variant="outline" className={authCardButtonInlineClass} onClick={onBack} disabled={submitting}>
              Back
            </Button>
          ) : null}
          <Button
            type="button"
            className={onBack ? authCardButtonInlineClass : authCardButtonClass}
            disabled={!canSubmit}
            onClick={() => void onSubmit({ displayName: displayName.trim(), slug: availability.slug })}
          >
            {submitting ? 'Creating workspace…' : submitLabel}
          </Button>
        </div>
        {onSkip ? (
          <Button
            type="button"
            variant="ghost"
            className="text-sm text-muted-foreground hover:text-foreground"
            disabled={submitting}
            onClick={onSkip}
          >
            {skipLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
