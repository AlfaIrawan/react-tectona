import { create } from 'zustand'
import type {
  WorkspaceGuideActionId,
  WorkspaceGuideWorkspace,
} from '@/modules/workspace-management/lib/workspaceManagementGuideTypes'

export type WorkspaceGuideBridge = {
  workspaces: WorkspaceGuideWorkspace[]
  canCreateWorkspace: boolean
  canMutate: boolean
  onAddNewWorkspace: () => void
  onWorkspaceAction: (action: WorkspaceGuideActionId, workspace: WorkspaceGuideWorkspace) => void
  prepareTour: (action: WorkspaceGuideActionId) => void
  openNewWorkspaceWizardForGuide: () => void
  closeNewWorkspaceWizardForGuide: () => void
  showNewWorkspaceWizardStepForGuide: (step: number) => void
}

interface WorkspaceManagementGuideState {
  open: boolean
  bridge: WorkspaceGuideBridge | null
  setOpen: (open: boolean) => void
  toggle: () => void
  registerBridge: (bridge: WorkspaceGuideBridge) => void
  unregisterBridge: () => void
}

export const useWorkspaceManagementGuideStore = create<WorkspaceManagementGuideState>((set) => ({
  open: false,
  bridge: null,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
  registerBridge: (bridge) => set({ bridge }),
  unregisterBridge: () => set({ bridge: null, open: false }),
}))
