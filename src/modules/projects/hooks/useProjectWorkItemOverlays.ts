import { useEffect, useMemo, useState } from 'react'
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
    .filter((row) => row !== null)
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
  const request = useMemo(() => ({ projectId, usesApiItems, revision }), [projectId, usesApiItems, revision])
  const [snapshot, setSnapshot] = useState<{
    request: typeof request
    inboxRoutes: ProjectInboxRouteApiModel[]
    archivedWorkItems: ProjectArchivedWorkItemApiModel[]
    usesDatabase: boolean
  } | null>(null)

  useEffect(() => {
    const { projectId, usesApiItems } = request
    if (!projectId) return
    let current = true
    const load = async () => {
      if (usesApiItems) {
        try {
          const [inbox, archived] = await Promise.all([
            listProjectInboxRoutes(projectId),
            listProjectArchivedWorkItems(projectId),
          ])
          return { inboxRoutes: inbox.items, archivedWorkItems: archived.items, usesDatabase: true }
        } catch {
          // Fall through to localStorage when work service is unreachable.
        }
      }
      return {
        inboxRoutes: localInboxRoutes(projectId),
        archivedWorkItems: localArchivedWorkItems(projectId),
        usesDatabase: false,
      }
    }
    void load().then((result) => {
      if (current) setSnapshot({ request, ...result })
    })
    return () => { current = false }
  }, [request])

  // Keep the last snapshot for a same-project refresh, never for a different scope.
  const active = snapshot?.request.projectId === projectId && snapshot?.request.usesApiItems === usesApiItems
    ? snapshot
    : null
  const inboxRoutes = active?.inboxRoutes ?? []
  const archivedWorkItems = active?.archivedWorkItems ?? []

  const pendingInboxKeys = new Set(inboxRoutes.map((route) => route.businessKey))
  const archivedWorkItemKeys = new Set(archivedWorkItems.map((record) => record.businessKey))

  return {
    inboxRoutes,
    archivedWorkItems,
    pendingInboxKeys,
    archivedWorkItemKeys,
    usesDatabase: active?.usesDatabase ?? false,
    loading: Boolean(projectId && active?.request !== request),
  }
}
