import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  CircleHelp,
  Eye,
  FolderKanban,
  Pencil,
  Plus,
  Settings2,
  TextCursorInput,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { EnterpriseInfoCallout } from '@/components/layout/EnterpriseInfoCallout'
import { cn } from '@/lib/utils'
import { useWorkspaceManagementGuideStore } from '@/stores/workspace-management-guide-store'
import {
  WORKSPACE_GUIDE_ACTION_LABELS,
  WORKSPACE_GUIDE_PICKER_DESCRIPTIONS,
  WORKSPACE_PICKER_ACTIONS,
  type WorkspaceGuideActionId,
  type WorkspaceGuideWorkspace,
} from '@/modules/workspace-management/lib/workspaceManagementGuideTypes'
import {
  runWorkspaceManagementGuideTour,
  waitForWorkspaceGuideTourTargets,
} from '@/modules/workspace-management/lib/workspaceManagementGuideTour'
import { getWorkspaceGuideTourSteps } from '@/modules/workspace-management/lib/workspaceManagementGuideTourSteps'

export type {
  WorkspaceGuideActionId,
  WorkspaceGuideWorkspace,
} from '@/modules/workspace-management/lib/workspaceManagementGuideTypes'

type GuideActionConfig = {
  id: WorkspaceGuideActionId
  description: string
  icon: LucideIcon
  destructive?: boolean
  requiresMutate?: boolean
  requiresWorkspace?: boolean
}

const GUIDE_ACTIONS: GuideActionConfig[] = [
  {
    id: 'add-new-workspace',
    description: 'Open the guided wizard to register a new workspace in the directory.',
    icon: Plus,
  },
  {
    id: 'view-workspace-details',
    description: 'Pick a workspace, then open its read-only detail drawer.',
    icon: Eye,
    requiresWorkspace: true,
  },
  {
    id: 'assign-governance',
    description: 'Pick a workspace, then configure operating model and governance posture.',
    icon: Settings2,
    requiresWorkspace: true,
  },
  {
    id: 'add-member',
    description: 'Pick a workspace, then invite a member with role and participation scope.',
    icon: UserPlus,
    requiresWorkspace: true,
  },
  {
    id: 'link-projects',
    description: 'Pick a workspace, then jump to activity flow to link delivery projects.',
    icon: FolderKanban,
    requiresWorkspace: true,
  },
  {
    id: 'rename-workspace',
    description: 'Pick a workspace, then rename it inline in the Workspace Directory table.',
    icon: TextCursorInput,
    requiresWorkspace: true,
    requiresMutate: true,
  },
  {
    id: 'edit-workspace',
    description: 'Pick a workspace, then open the edit drawer for ownership and metadata.',
    icon: Pencil,
    requiresWorkspace: true,
    requiresMutate: true,
  },
  {
    id: 'delete-workspace',
    description: 'Pick a workspace, then confirm deletion with impact safeguards.',
    icon: Trash2,
    requiresWorkspace: true,
    requiresMutate: true,
    destructive: true,
  },
]

function GuideSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function GuideActionButton({
  action,
  disabled,
  onClick,
}: {
  action: GuideActionConfig
  disabled: boolean
  onClick: () => void
}) {
  const Icon = action.icon
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-3 text-left transition-all',
        'hover:border-primary/25 hover:bg-accent/40 active:scale-[0.995]',
        'disabled:pointer-events-none disabled:opacity-50',
        action.destructive && 'hover:border-rose-300/60 hover:bg-rose-50/70 dark:hover:bg-rose-950/20',
      )}
    >
      <span
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-border/50',
          action.destructive && 'bg-rose-50 text-rose-600 ring-rose-200/70 dark:bg-rose-950/30 dark:text-rose-300',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-medium text-foreground',
            action.destructive && 'text-rose-600 dark:text-rose-400',
          )}
        >
          {WORKSPACE_GUIDE_ACTION_LABELS[action.id]}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{action.description}</span>
      </span>
    </button>
  )
}

export function WorkspaceManagementGuideDrawer() {
  const open = useWorkspaceManagementGuideStore((s) => s.open)
  const setOpen = useWorkspaceManagementGuideStore((s) => s.setOpen)
  const bridge = useWorkspaceManagementGuideStore((s) => s.bridge)

  const [pickerAction, setPickerAction] = useState<WorkspaceGuideActionId | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')

  const sortedWorkspaces = useMemo(
    () =>
      [...(bridge?.workspaces ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [bridge?.workspaces],
  )

  useEffect(() => {
    if (!open) {
      setPickerAction(null)
      setSelectedWorkspaceId('')
    }
  }, [open])

  const closeDrawer = () => setOpen(false)

  const backToActions = () => {
    setPickerAction(null)
    setSelectedWorkspaceId('')
  }

  const openPicker = (action: WorkspaceGuideActionId) => {
    setPickerAction(action)
    setSelectedWorkspaceId(sortedWorkspaces[0]?.id ?? '')
  }

  const startGuideTour = async (
    action: WorkspaceGuideActionId,
    workspace?: WorkspaceGuideWorkspace,
  ) => {
    if (!bridge?.prepareTour) return
    if (
      action === 'add-new-workspace'
      && (!bridge.openNewWorkspaceWizardForGuide || !bridge.showNewWorkspaceWizardStepForGuide)
    ) {
      return
    }
    closeDrawer()
    bridge.prepareTour(action)
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve())
      })
    })
    const steps = await waitForWorkspaceGuideTourTargets(action)
    if (steps.length === 0) return
    const allSteps = getWorkspaceGuideTourSteps(action)
    runWorkspaceManagementGuideTour(action, allSteps, {
      prepare: {
        openNewWorkspaceWizard: bridge.openNewWorkspaceWizardForGuide,
        closeNewWorkspaceWizard: bridge.closeNewWorkspaceWizardForGuide,
        showNewWorkspaceWizardStep: bridge.showNewWorkspaceWizardStepForGuide,
      },
      onDestroyed: () => {
        if (action === 'add-new-workspace') return
        if (workspace && WORKSPACE_PICKER_ACTIONS.includes(action)) {
          bridge.onWorkspaceAction(action, workspace)
        }
      },
    })
  }

  const confirmPicker = () => {
    if (!bridge || !pickerAction || !selectedWorkspaceId) return
    const workspace = sortedWorkspaces.find((w) => w.id === selectedWorkspaceId)
    if (!workspace) return
    void startGuideTour(pickerAction, workspace)
  }

  const handleActionClick = (action: GuideActionConfig) => {
    if (!bridge) return
    if (action.requiresWorkspace && sortedWorkspaces.length === 0) return
    if (WORKSPACE_PICKER_ACTIONS.includes(action.id)) {
      openPicker(action.id)
      return
    }
    void startGuideTour(action.id)
  }

  const isActionDisabled = (action: GuideActionConfig) => {
    if (!bridge) return true
    if (action.id === 'add-new-workspace') return !bridge.canCreateWorkspace
    if (action.requiresMutate && !bridge.canMutate) return true
    if (action.requiresWorkspace && sortedWorkspaces.length === 0) return true
    return false
  }

  if (typeof document === 'undefined') return null

  const pickerKey =
    pickerAction && pickerAction !== 'add-new-workspace' ? pickerAction : null

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-0 z-[1090] bg-black/20 backdrop-blur-sm transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeDrawer}
        aria-hidden={!open}
      />
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[1095] flex w-[min(100%,420px)] max-w-[92vw] flex-col border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl transition-all duration-300',
          open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0',
        )}
        style={{
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-management-guide-title"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
          <div className="min-w-0 pr-3">
            <h2
              id="workspace-management-guide-title"
              className="flex items-center gap-2 text-lg font-semibold text-foreground"
            >
              <CircleHelp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              Manual &amp; Guide
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Pick a task below to launch an interactive walkthrough — the spotlight moves step by step, like the sign-in
              guide.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={closeDrawer}
            aria-label="Close manual and guide drawer"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-5 py-5">
          {!bridge ? (
            <p className="text-sm text-muted-foreground">Guide is loading…</p>
          ) : pickerKey ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={backToActions}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to guide actions
              </button>

              <GuideSectionCard title="Select workspace">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {WORKSPACE_GUIDE_ACTION_LABELS[pickerKey]}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {WORKSPACE_GUIDE_PICKER_DESCRIPTIONS[pickerKey]}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="workspace-guide-picker" className="text-xs font-medium text-foreground">
                      Workspace
                    </label>
                    <Select
                      id="workspace-guide-picker"
                      value={selectedWorkspaceId}
                      onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                      className="h-10 w-full"
                    >
                      <option value="" disabled>
                        Select workspace
                      </option>
                      {sortedWorkspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name} ({workspace.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={backToActions}>
                      Cancel
                    </Button>
                    <Button type="button" disabled={!selectedWorkspaceId} onClick={() => void confirmPicker()}>
                      Start guide
                    </Button>
                  </div>
                </div>
              </GuideSectionCard>
            </div>
          ) : (
            <div className="space-y-4">
              <EnterpriseInfoCallout title="How to use this guide">
                Select an action to start a moving spotlight tour. When a workspace is required, choose the target first —
                the workflow opens automatically when you click Done on the last step.
              </EnterpriseInfoCallout>

              <GuideSectionCard title="Guide actions">
                <div className="space-y-2">
                  {GUIDE_ACTIONS.map((action) => (
                    <GuideActionButton
                      key={action.id}
                      action={action}
                      disabled={isActionDisabled(action)}
                      onClick={() => handleActionClick(action)}
                    />
                  ))}
                </div>
              </GuideSectionCard>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
