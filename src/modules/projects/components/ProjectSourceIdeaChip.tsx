import { useState } from 'react'
import { ExternalLink, Lightbulb, Link2, Loader2, Unlink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { EnterpriseViewControlButton } from '@/components/enterprise/EnterpriseViewControlRail'
import { patchIdea, type IdeaApi } from '@/lib/api/ideaBacklogApi'
import { LinkProjectIdeaModal } from './LinkProjectIdeaModal'

export function ProjectSourceIdeaChip({
  projectId,
  projectName,
  linkedIdea,
  loading,
  onLinked,
  onUnlinked,
}: {
  projectId: string
  projectName: string
  linkedIdea: IdeaApi | null
  loading?: boolean
  onLinked: (idea: IdeaApi) => void
  onUnlinked: () => void
}) {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  const handleUnlink = async () => {
    if (!linkedIdea) return
    setUnlinking(true)
    try {
      await patchIdea(linkedIdea.id, {
        project_id: null,
        version: linkedIdea.version,
      })
      onUnlinked()
      addToast({
        title: 'Idea unlinked',
        description: `"${linkedIdea.title}" is no longer linked to this project.`,
        variant: 'success',
      })
    } catch (error: unknown) {
      addToast({
        title: 'Unlink failed',
        description: error instanceof Error ? error.message : 'Could not unlink idea from project.',
        variant: 'error',
      })
    } finally {
      setUnlinking(false)
    }
  }

  const linkModal = (
    <LinkProjectIdeaModal
      open={linkModalOpen}
      onOpenChange={setLinkModalOpen}
      projectId={projectId}
      projectName={projectName}
      currentLinkedIdea={linkedIdea}
      onLinked={onLinked}
    />
  )

  if (loading) {
    return (
      <>
        <EnterpriseViewControlButton aria-label="Loading source idea" disabled>
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
        </EnterpriseViewControlButton>
        {linkModal}
      </>
    )
  }

  if (!linkedIdea) {
    return (
      <>
        <Tooltip content="Link to idea" side="bottom" size="compact" sideOffset={6}>
          <EnterpriseViewControlButton
            aria-label="Link to idea"
            onClick={() => setLinkModalOpen(true)}
          >
            <Link2 className="h-5 w-5" strokeWidth={1.8} />
          </EnterpriseViewControlButton>
        </Tooltip>
        {linkModal}
      </>
    )
  }

  const tooltipText = linkedIdea.title.length > 42 ? `${linkedIdea.title.slice(0, 42)}…` : linkedIdea.title

  return (
    <>
      <DropdownMenu>
        <Tooltip content={`Source idea · ${tooltipText}`} side="bottom" size="compact" sideOffset={6}>
          <DropdownMenuTrigger asChild>
            <EnterpriseViewControlButton active aria-label={`Source idea: ${linkedIdea.title}`}>
              <Lightbulb className="h-5 w-5" strokeWidth={1.8} />
            </EnterpriseViewControlButton>
          </DropdownMenuTrigger>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => navigate(`/idea-backlog/${linkedIdea.id}`)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View idea
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLinkModalOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            Change linked idea
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={unlinking} onClick={() => void handleUnlink()}>
            <Unlink className="mr-2 h-4 w-4" />
            Unlink idea
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {linkModal}
    </>
  )
}
