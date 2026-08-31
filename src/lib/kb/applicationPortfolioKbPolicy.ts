import { patchKbEntry, type KbEntryResponse } from '@/lib/api/tectonaKbApi'
import { ADIRA_APPLICATION_CATALOG_TITLE, isAdiraFinanceWorkspaceId } from '@/lib/kb/adiraApplicationGlossary'
import { parseApmConnectedWorkspaceIds, readConfiguredApmWorkspaceIds } from '@/lib/kb/apmWorkspaceConfig'
import { isApplicationCatalogDefaultTitle } from '@/lib/kb/systemKbEntry'

export { parseApmConnectedWorkspaceIds, readConfiguredApmWorkspaceIds }

function sameWorkspaceId(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? '').trim() === (right ?? '').trim()
}

export function isManagedApplicationPortfolioCatalogTitle(title: string): boolean {
  return title.trim().toLowerCase() === ADIRA_APPLICATION_CATALOG_TITLE.toLowerCase()
}

export function workspaceHasStrongerApplicationSource(
  entries: KbEntryResponse[],
  workspaceId: string,
  apmWorkspaceIds: ReadonlySet<string> = new Set(),
): boolean {
  if (apmWorkspaceIds.has(workspaceId)) return true
  if (!isAdiraFinanceWorkspaceId(workspaceId)) return false
  return entries.some((entry) => (
    isManagedApplicationPortfolioCatalogTitle(entry.title)
    && sameWorkspaceId(entry.workspace_id, workspaceId)
  ))
}

export function shouldSkipDefaultApplicationCatalog(
  workspaceId: string,
  entries: KbEntryResponse[],
  apmWorkspaceIds: ReadonlySet<string> = new Set(),
): boolean {
  return workspaceHasStrongerApplicationSource(entries, workspaceId, apmWorkspaceIds)
}

/** KB application-catalog templates to turn off for AI when a stronger SoR exists. Never re-enables. */
export function applicationCatalogEntriesToDisable(
  entries: KbEntryResponse[],
  apmWorkspaceIds: ReadonlySet<string> = new Set(),
): KbEntryResponse[] {
  return entries.filter((entry) => {
    if (!isApplicationCatalogDefaultTitle(entry.title)) return false
    if (entry.is_active === false) return false
    const workspaceId = (entry.workspace_id ?? '').trim()
    if (!workspaceId) return false
    return workspaceHasStrongerApplicationSource(entries, workspaceId, apmWorkspaceIds)
  })
}

export function applicationSourceNotice(
  entry: Pick<KbEntryResponse, 'title' | 'workspace_id'>,
  entries: KbEntryResponse[],
  apmWorkspaceIds: ReadonlySet<string> = readConfiguredApmWorkspaceIds(),
): string | null {
  const workspaceId = (entry.workspace_id ?? '').trim()
  if (isManagedApplicationPortfolioCatalogTitle(entry.title)) {
    return 'Official application list for this workspace. Keep the KB Application Catalog off for AI.'
  }
  if (!isApplicationCatalogDefaultTitle(entry.title) || !workspaceId) return null
  if (!workspaceHasStrongerApplicationSource(entries, workspaceId, apmWorkspaceIds)) return null
  if (apmWorkspaceIds.has(workspaceId)) {
    return 'Application source: APM. This catalog stays in KB as an archive and is not used for AI.'
  }
  return 'Application source: portfolio. This catalog stays in KB as an archive and is not used for AI.'
}

export async function disableSupersededApplicationCatalogs(
  entries: KbEntryResponse[],
  apmWorkspaceIds: ReadonlySet<string> = readConfiguredApmWorkspaceIds(),
): Promise<KbEntryResponse[]> {
  const updated: KbEntryResponse[] = []
  for (const entry of applicationCatalogEntriesToDisable(entries, apmWorkspaceIds)) {
    try {
      updated.push(await patchKbEntry(entry.id, { is_active: false }))
    } catch {
      // Best-effort: keep the catalog visible; AI filter still depends on is_active.
    }
  }
  return updated
}
