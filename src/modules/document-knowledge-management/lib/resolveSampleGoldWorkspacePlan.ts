import { isOrganizationHomeWorkspace } from '@/lib/workspaceOwnershipVisibility'

export type SampleGoldWorkspaceRef = {
  id: string
  name: string
  role: 'home' | 'overlay'
}

export type SampleGoldWorkspacePlan = {
  mode: 'personal_only' | 'org_vote'
  organizationId: string | null
  home: SampleGoldWorkspaceRef | null
  overlays: SampleGoldWorkspaceRef[]
}

export type SampleGoldWorkspaceInput = {
  id: string
  name: string
  organizationId: string
  tenantMode?: string | null
  isNestedOrgPersonal?: boolean
  metadata?: Record<string, unknown> | null
}

function isPersonalWorkspace(workspace: SampleGoldWorkspaceInput): boolean {
  if ((workspace.tenantMode || '').toLowerCase() === 'personal') return true
  return workspace.isNestedOrgPersonal === true
}

function mergeWorkspace(
  accessible: readonly SampleGoldWorkspaceInput[],
  catalog: readonly SampleGoldWorkspaceInput[],
  id: string,
): SampleGoldWorkspaceInput | null {
  return accessible.find((row) => row.id === id)
    ?? catalog.find((row) => row.id === id)
    ?? null
}

/**
 * Organization home is the gold-set SoR. Other non-personal workspaces in the same
 * organization are overlays. Personal uploads stay local-only.
 */
export function resolveSampleGoldWorkspacePlan(input: {
  uploadWorkspaceId: string | null
  accessible: readonly SampleGoldWorkspaceInput[]
  catalog?: readonly SampleGoldWorkspaceInput[]
}): SampleGoldWorkspacePlan {
  const catalog = input.catalog ?? []
  const uploadId = (input.uploadWorkspaceId || '').trim()
  if (!uploadId) {
    return { mode: 'personal_only', organizationId: null, home: null, overlays: [] }
  }

  const upload = mergeWorkspace(input.accessible, catalog, uploadId)
  if (!upload || isPersonalWorkspace(upload)) {
    return { mode: 'personal_only', organizationId: upload?.organizationId ?? null, home: null, overlays: [] }
  }

  const organizationId = upload.organizationId.trim()
  if (!organizationId) {
    return { mode: 'personal_only', organizationId: null, home: null, overlays: [] }
  }

  const sameOrgCatalog = catalog.filter((row) => row.organizationId === organizationId && !isPersonalWorkspace(row))
  const homeRow = sameOrgCatalog.find((row) => isOrganizationHomeWorkspace({ metadata: row.metadata }))
    ?? sameOrgCatalog.find((row) => row.id === uploadId)
    ?? upload

  const home: SampleGoldWorkspaceRef = {
    id: homeRow.id,
    name: homeRow.name,
    role: 'home',
  }

  const seen = new Set<string>([home.id])
  const overlays: SampleGoldWorkspaceRef[] = []
  for (const row of input.accessible) {
    if (row.organizationId !== organizationId) continue
    if (isPersonalWorkspace(row)) continue
    if (seen.has(row.id)) continue
    seen.add(row.id)
    overlays.push({ id: row.id, name: row.name, role: 'overlay' })
  }

  return { mode: 'org_vote', organizationId, home, overlays }
}
