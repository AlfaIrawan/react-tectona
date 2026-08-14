import { useCallback, useEffect, useState } from 'react'
import type {
  ProjectArchivedWorkItemApiModel,
  ProjectInboxRouteApiModel,
} from '@/lib/api/workApi'
import {
  listProjectArchivedWorkItems,
  listProjectInboxRoutes,
} from '@/lib/api/workApi'
import {
  listArchivedWorkItemRecords,
} from '../lib/projectArchivedStore'
import {
  listInboxWorkItemRecords,
  listPendingInboxWorkItemIds,
} from '../lib/projectInboxStore'

export type ProjectWorkItemOverlays = {
  inboxRoutes: ProjectInboxRouteApiModel[]
  archivedWorkItems: ProjectArchivedWorkItemApiModel[]
  pendingInboxKeys: Set<string>
  archivedWorkItemKeys: Set<string>
  usesDatabase: boolean
  loading: boolean
  reload: () => Promise<void>
}

function localInboxRoutes(projectId: string): ProjectInboxRouteApiModel[] {
  const store = listInboxWorkItemRecords(projectId)
  return listPendingInboxWorkItemIds(projectId)
    .map((businessKey) => {
      const record = store[businessKey]
      if (!record || record.status !== 'pending') return null
      return {
        businessKey,
        routedAt: record.routedAt,
        routedBy: record.routedBy,
        sourceTeam: record.sourceTeam,
        sourceChannel: record.sourceChannel,
        requestNote: record.requestNote ?? null,
        status: record.status,
      } satisfies ProjectInboxRouteApiModel
    })
    .filter((row): row is ProjectInboxRouteApiModel => row != null)
}

function localArchivedWorkItems(projectId: string): ProjectArchivedWorkItemApiModel[] {
  const store = listArchivedWorkItemRecords(projectId)
  return Object.entries(store).map(([businessKey, record]) => ({
    businessKey,
    archivedAt: record.archivedAt,
    archivedBy: record.archivedBy,
    reason: record.reason,
  }))
}

export function useProjectWorkItemOverlays(
  projectId: string | undefined,
  usesApiItems: boolean,
  revision = 0,
): ProjectWorkItemOverlays {
  const [inboxRoutes, setInboxRoutes] = useState<ProjectInboxRouteApiModel[]>([])
  const [archivedWorkItems, setArchivedWorkItems] = useState<ProjectArchivedWorkItemApiModel[]>([])
  const [loading, setLoading] = useState(true)
  const [usesDatabase, setUsesDatabase] = useState(false)

  const reload = useCallback(async () => {
    if (!projectId) {
      setInboxRoutes([])
      setArchivedWorkItems([])
      setUsesDatabase(false)
      setLoading(false)
      return
    }

    setLoading(true)
    if (usesApiItems) {
      try {
        const [inboxResponse, archivedResponse] = await Promise.all([
          listProjectInboxRoutes(projectId),
          listProjectArchivedWorkItems(projectId),
        ])
        setInboxRoutes(inboxResponse.items)
        setArchivedWorkItems(archivedResponse.items)
        setUsesDatabase(true)
        setLoading(false)
        return
      } catch {
        // Fall through to localStorage when work service is unreachable.
      }
    }

    setInboxRoutes(localInboxRoutes(projectId))
    setArchivedWorkItems(localArchivedWorkItems(projectId))
    setUsesDatabase(false)
    setLoading(false)
  }, [projectId, usesApiItems])

  useEffect(() => {
    void reload()
  }, [reload, revision])

  const pendingInboxKeys = new Set(inboxRoutes.map((route) => route.businessKey))
  const archivedWorkItemKeys = new Set(archivedWorkItems.map((record) => record.businessKey))

  return {
    inboxRoutes,
    archivedWorkItems,
    pendingInboxKeys,
    archivedWorkItemKeys,
    usesDatabase,
    loading,
    reload,
  }
}
