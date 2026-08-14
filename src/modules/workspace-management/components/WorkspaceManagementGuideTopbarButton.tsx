import { useLocation } from 'react-router-dom'
import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useWorkspaceManagementGuideStore } from '@/stores/workspace-management-guide-store'

export function WorkspaceManagementGuideTopbarButton() {
  const location = useLocation()
  const open = useWorkspaceManagementGuideStore((s) => s.open)
  const toggle = useWorkspaceManagementGuideStore((s) => s.toggle)
  const bridge = useWorkspaceManagementGuideStore((s) => s.bridge)

  const onWorkspaceManagement =
    location.pathname.includes('/workspace-management') && bridge != null

  if (!onWorkspaceManagement) return null

  return (
    <Tooltip content="Manual & Guide" side="bottom" size="compact" sideOffset={6}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'topbar-action-btn hover:bg-gray-100',
          open && 'bg-gray-100 ring-1 ring-slate-300/80',
        )}
        aria-label="Open Workspace Management manual and guide"
        aria-pressed={open}
        onClick={toggle}
      >
        <CircleHelp className="h-4 w-4 text-gray-600 topbar-action-icon" />
      </Button>
    </Tooltip>
  )
}
