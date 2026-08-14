import type { DriveStep } from 'driver.js'
import type { WorkspaceGuideActionId } from '@/modules/workspace-management/lib/workspaceManagementGuideTypes'

export type WorkspaceGuideTourPrepare =
  | 'open-new-workspace-wizard'
  | 'close-new-workspace-wizard'
  | `new-workspace-wizard-${1 | 2 | 3 | 4 | 5 | 6}`

export type WorkspaceGuideTourStep = DriveStep & {
  wmPrepare?: WorkspaceGuideTourPrepare[]
}

export function tourTarget(key: string) {
  return () => document.querySelector(`[data-tour-target="${key}"]`) as Element
}

function navStep(panelKey: string, title: string, description: string): WorkspaceGuideTourStep {
  return {
    element: tourTarget(`wm-nav-${panelKey}`),
    popover: { title, description, side: 'right', align: 'start' },
  }
}

function newWorkspaceWizardStep(
  step: 1 | 2 | 3 | 4 | 5 | 6,
  title: string,
  description: string,
  prepare: WorkspaceGuideTourPrepare[],
): WorkspaceGuideTourStep {
  return {
    element: tourTarget('wm-new-workspace-wizard-content'),
    wmPrepare: prepare,
    popover: { title, description, side: 'left', align: 'start' },
  }
}

export function getWorkspaceGuideTourSteps(action: WorkspaceGuideActionId): WorkspaceGuideTourStep[] {
  switch (action) {
    case 'add-new-workspace':
      return [
        navStep(
          'directory',
          'Workspace Directory',
          'New workspaces are registered from the directory catalog. This guide walks you through the controls step by step.',
        ),
        {
          element: tourTarget('wm-filters-panel'),
          popover: {
            title: 'Search & Filters',
            description: 'Use search and status chips to find workspaces before adding a new one.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: tourTarget('wm-directory-panel'),
          popover: {
            title: 'Workspace table',
            description: 'Review existing workspaces here. Your new entry will appear in this catalog after creation.',
            side: 'top',
            align: 'start',
          },
        },
        {
          element: tourTarget('wm-new-workspace-btn'),
          popover: {
            title: 'Launch the wizard',
            description: 'Click Next to open the guided New Workspace wizard — we will tour each wizard step.',
            side: 'bottom',
            align: 'start',
          },
        },
        newWorkspaceWizardStep(
          1,
          'Step 1 — Basic information',
          'Enter workspace name (code is generated automatically) and an optional description.',
          ['open-new-workspace-wizard', 'new-workspace-wizard-1'],
        ),
        newWorkspaceWizardStep(
          2,
          'Step 2 — Organization scope',
          'Select the primary organization, optional related units, and verified domains.',
          ['new-workspace-wizard-2'],
        ),
        newWorkspaceWizardStep(
          3,
          'Step 3 — Workspace classification',
          'Choose the workspace type that defines this organizational boundary.',
          ['new-workspace-wizard-3'],
        ),
        newWorkspaceWizardStep(
          4,
          'Step 4 — Ownership & responsibility',
          'Assign Owner (required) and optional Business / Technical owners.',
          ['new-workspace-wizard-4'],
        ),
        newWorkspaceWizardStep(
          5,
          'Step 5 — Lifecycle',
          'Set the lifecycle stage for this workspace boundary.',
          ['new-workspace-wizard-5'],
        ),
        newWorkspaceWizardStep(
          6,
          'Step 6 — Review & create',
          'Review the summary, acknowledge checks, then submit to register the workspace.',
          ['new-workspace-wizard-6'],
        ),
      ]

    case 'view-workspace-details':
      return [
        navStep('directory', 'Workspace Directory', 'Open the directory to browse all workspaces in scope.'),
        {
          element: tourTarget('wm-directory-panel'),
          popover: {
            title: 'Workspace table',
            description:
              'Click a row to open read-only details, or right-click a row and choose View Workspace Details.',
            side: 'top',
            align: 'start',
          },
        },
      ]

    case 'assign-governance':
      return [
        navStep('governance', 'Governance Matrix', 'Review operating model, compliance, and risk posture per workspace.'),
        {
          element: tourTarget('wm-filters-panel'),
          popover: {
            title: 'Filter governance rows',
            description: 'Narrow the matrix with search and governance health filters.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: tourTarget('wm-assign-governance-btn'),
          popover: {
            title: 'Assign Governance',
            description:
              'Click to open the assignment dialog, pick a workspace, and configure templates and operating model.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: tourTarget('wm-governance-panel'),
          popover: {
            title: 'Matrix actions',
            description: 'You can also right-click any row to assign or edit governance for that workspace.',
            side: 'top',
            align: 'start',
          },
        },
      ]

    case 'add-member':
      return [
        navStep('members', 'Workspace Members', 'Manage membership, roles, and participation scope.'),
        {
          element: tourTarget('wm-filters-panel'),
          popover: {
            title: 'Find members',
            description: 'Search by member, workspace, team, or role before inviting someone new.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: tourTarget('wm-invite-member-btn'),
          popover: {
            title: 'Add Member in Workspace',
            description:
              'Click Invite Member to open the drawer, select the workspace, and define role plus participation scope.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: tourTarget('wm-members-panel'),
          popover: {
            title: 'Member rows',
            description:
              'Right-click a member row for workspace-specific shortcuts including Add Member and View Workspace Details.',
            side: 'top',
            align: 'start',
          },
        },
      ]

    case 'link-projects':
      return [
        navStep('activity', 'My Activity & Audit', 'Track workspace activity and delivery linkage signals.'),
        {
          element: tourTarget('wm-filters-panel'),
          popover: {
            title: 'Filter activity',
            description: 'Search by workspace name or code to focus on the workspace you want to link projects for.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: tourTarget('wm-activity-panel'),
          popover: {
            title: 'Link projects',
            description:
              'Use activity context to trace delivery linkage. For directory-level linking, open Workspace Directory and use Link Projects from the row menu.',
            side: 'top',
            align: 'start',
          },
        },
        navStep(
          'directory',
          'Directory shortcut',
          'Switch back to Directory anytime — right-click a workspace row and choose Link Projects.',
        ),
      ]

    case 'rename-workspace':
      return [
        navStep('directory', 'Workspace Directory', 'Renaming is done inline in the directory table.'),
        {
          element: tourTarget('wm-directory-panel'),
          popover: {
            title: 'Pick a workspace row',
            description: 'Right-click the workspace you want to rename.',
            side: 'top',
            align: 'start',
          },
        },
      ]

    case 'edit-workspace':
      return [
        navStep('directory', 'Workspace Directory', 'Workspace metadata is edited from the directory catalog.'),
        {
          element: tourTarget('wm-directory-panel'),
          popover: {
            title: 'Select a workspace',
            description: 'Right-click the target row to open the context menu, then choose Edit Workspace.',
            side: 'top',
            align: 'start',
          },
        },
      ]

    case 'delete-workspace':
      return [
        navStep('directory', 'Workspace Directory', 'Deletion is initiated from the directory for a specific workspace.'),
        {
          element: tourTarget('wm-directory-panel'),
          popover: {
            title: 'Select a workspace',
            description: 'Right-click the workspace you intend to remove, then choose Delete Workspace.',
            side: 'top',
            align: 'start',
          },
        },
      ]

    default:
      return []
  }
}

export function getWorkspaceGuideTourInitialSteps(action: WorkspaceGuideActionId): WorkspaceGuideTourStep[] {
  return getWorkspaceGuideTourSteps(action).filter((step) => !step.wmPrepare?.length)
}

export function isDeferredWorkspaceGuideTourStep(step: WorkspaceGuideTourStep): boolean {
  return Boolean(step.wmPrepare?.length)
}
