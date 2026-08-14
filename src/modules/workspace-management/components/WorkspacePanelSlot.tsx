import { memo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type WorkspaceManagementPanelId =
  | 'overview'
  | 'directory'
  | 'governance'
  | 'members'
  | 'assets'
  | 'activity'

type WorkspacePanelSlotProps = {
  panelId: WorkspaceManagementPanelId
  activePanel: WorkspaceManagementPanelId
  visitedPanels: ReadonlySet<WorkspaceManagementPanelId>
  children: ReactNode
}

/** Keeps panel subtrees mounted after first visit; toggles visibility instead of unmounting. */
export const WorkspacePanelSlot = memo(function WorkspacePanelSlot({
  panelId,
  activePanel,
  visitedPanels,
  children,
}: WorkspacePanelSlotProps) {
  if (!visitedPanels.has(panelId)) return null
  const visible = activePanel === panelId
  return (
    <div className={cn(!visible && 'hidden')} aria-hidden={!visible}>
      {children}
    </div>
  )
})
