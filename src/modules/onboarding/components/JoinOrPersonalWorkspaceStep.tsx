import { FolderPlus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { authCardButtonClass } from '@/lib/authUiClasses'

const onboardingStackButtonClass = authCardButtonClass

type JoinOrPersonalWorkspaceStepProps = {
  organizationName?: string
  onBack: () => void
  onJoinBySlug: () => void
  onCreatePersonal: () => void
  submitting: boolean
}

export function JoinOrPersonalWorkspaceStep({
  organizationName,
  onBack,
  onJoinBySlug,
  onCreatePersonal,
  submitting,
}: JoinOrPersonalWorkspaceStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold">Join a workspace or create your own</h2>
        <p className="text-sm text-muted-foreground">
          {organizationName
            ? `Choose a team workspace under ${organizationName}, or create a personal workspace. Your personal workspace includes the Workspace module for self-management; organization Workspace Management stays Admin-gated.`
            : 'Join an existing workspace by slug, or create a personal workspace with its own Workspace module for self-management.'}
        </p>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className={onboardingStackButtonClass}
          disabled={submitting}
          onClick={onJoinBySlug}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span>Join a specific workspace (enter slug)</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          className={onboardingStackButtonClass}
          disabled={submitting}
          onClick={onCreatePersonal}
        >
          <FolderPlus className="h-4 w-4 shrink-0" aria-hidden />
          <span>Create personal workspace</span>
        </Button>
      </div>

      <div className="flex justify-center">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
          Back
        </Button>
      </div>
    </div>
  )
}
