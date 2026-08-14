import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { useWorkspacePath } from '@/hooks/useWorkspaceNavigate'
import { LineageDetailDrawer } from '@/modules/traceability-monitoring/components/LineageDetailDrawer'
import { LineageGraphCanvas, type LineageRootDraft } from '@/modules/traceability-monitoring/components/LineageGraphCanvas'
import { useLineageGraphQuery } from '@/modules/traceability-monitoring/hooks/useLineageGraphQuery'
import { useLineageNodeQuery } from '@/modules/traceability-monitoring/hooks/useLineageNodeQuery'

function sorPathForEntity(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'idea':
      return `/idea-backlog/${entityId}`
    case 'project':
      return `/projects/${entityId}`
    case 'work_item':
      return '/task-work-management'
    case 'document':
      return '/document-knowledge-management'
    case 'workspace':
      return '/workspace-management'
    default:
      return null
  }
}

export function EntityLineagePage() {
  const tenant = useTenantContextOptional()
  const [searchParams, setSearchParams] = useSearchParams()

  const rootType = searchParams.get('rootType') || 'idea'
  const rootId = searchParams.get('rootId') || ''
  const [depth, setDepth] = useState(2)

  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string } | null>(null)

  const { data, isLoading, isError, refetch } = useLineageGraphQuery(
    rootId ? { workspaceId: tenant?.workspaceId, rootType, rootId, depth } : null,
  )

  const { data: neighbors, isLoading: neighborsLoading } = useLineageNodeQuery(
    selectedEntity ? { entityType: selectedEntity.type, entityId: selectedEntity.id, workspaceId: tenant?.workspaceId } : null,
  )

  const rawSorPath = selectedEntity ? sorPathForEntity(selectedEntity.type, selectedEntity.id) : null
  const sorHref = useWorkspacePath(rawSorPath ?? '/')

  const handleSubmitRoot = (draft: LineageRootDraft) => {
    setSearchParams({ rootType: draft.rootType, rootId: draft.rootId })
    setSelectedEntity(null)
  }

  const handleSelectNode = (entityType: string, entityId: string) => {
    setSelectedEntity({ type: entityType, id: entityId })
  }

  return (
    <div className="relative h-full min-h-[480px]">
      <LineageGraphCanvas
        nodes={data?.nodes ?? []}
        edges={data?.edges ?? []}
        rootType={rootType}
        rootId={rootId}
        depth={depth}
        truncated={data?.truncated ?? false}
        loading={isLoading}
        error={isError ? 'Failed to load lineage graph. Confirm the Tectona Activity & Lineage service is running.' : null}
        onSubmitRoot={handleSubmitRoot}
        onDepthChange={setDepth}
        onSelectNode={handleSelectNode}
        emptyMessage={rootId ? undefined : 'Pick a root entity to load its lineage graph.'}
      />
      <LineageDetailDrawer
        open={selectedEntity !== null}
        loading={neighborsLoading}
        neighbors={neighbors ?? null}
        sorHref={rawSorPath ? sorHref : null}
        onClose={() => setSelectedEntity(null)}
        onSelectNode={handleSelectNode}
      />
      {isError ? (
        <button
          type="button"
          className="absolute bottom-3 left-3 z-30 rounded-lg border border-border/70 bg-card/95 px-3 py-1.5 text-xs font-medium shadow-sm"
          onClick={() => refetch()}
        >
          Retry loading graph
        </button>
      ) : null}
    </div>
  )
}
