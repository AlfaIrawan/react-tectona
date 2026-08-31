import { describe, expect, it } from 'vitest'
import type { KbEntryResponse } from '@/lib/api/tectonaKbApi'
import { ADIRA_APPLICATION_CATALOG_TITLE, ADIRA_FINANCE_WORKSPACE_KEY } from '@/lib/kb/adiraApplicationGlossary'
import {
  applicationCatalogEntriesToDisable,
  applicationSourceNotice,
  isManagedApplicationPortfolioCatalogTitle,
  parseApmConnectedWorkspaceIds,
  shouldSkipDefaultApplicationCatalog,
  workspaceHasStrongerApplicationSource,
} from './applicationPortfolioKbPolicy'

function entry(partial: Partial<KbEntryResponse> & Pick<KbEntryResponse, 'title'>): KbEntryResponse {
  return {
    id: partial.id ?? 'kb-1',
    category: partial.category ?? 'application_catalog',
    title: partial.title,
    content: partial.content ?? '',
    is_active: partial.is_active ?? true,
    priority: partial.priority ?? 83,
    workspace_id: partial.workspace_id ?? ADIRA_FINANCE_WORKSPACE_KEY,
    department_id: null,
    department_name_snapshot: null,
    division_id: null,
    division_name_snapshot: null,
    owner_department_id: null,
    audience_departments: [],
    visibility_scope: 'internal',
    created_at: '',
    updated_at: '',
    ...partial,
  }
}

describe('applicationPortfolioKbPolicy', () => {
  it('parses configured APM workspace ids', () => {
    expect([...parseApmConnectedWorkspaceIds(' ws-1,ws-2, ')]).toEqual(['ws-1', 'ws-2'])
  })

  it('treats the Adira catalog as a stronger application source', () => {
    const items = [
      entry({ id: 'generic', title: 'Application Catalog (Default)' }),
      entry({ id: 'adira', title: ADIRA_APPLICATION_CATALOG_TITLE, category: 'domain_glossary' }),
    ]
    expect(workspaceHasStrongerApplicationSource(items, ADIRA_FINANCE_WORKSPACE_KEY)).toBe(true)
    expect(isManagedApplicationPortfolioCatalogTitle(ADIRA_APPLICATION_CATALOG_TITLE)).toBe(true)
    expect(applicationCatalogEntriesToDisable(items).map((item) => item.id)).toEqual(['generic'])
  })

  it('does not disable the default catalog when no stronger source exists', () => {
    const workspaceId = '00000000-0000-0000-0000-000000000099'
    const items = [entry({ id: 'generic', title: 'Application Catalog (Default)', workspace_id: workspaceId })]
    expect(applicationCatalogEntriesToDisable(items)).toEqual([])
  })

  it('disables the default catalog when the workspace is marked APM-connected', () => {
    const workspaceId = 'ws-apm'
    const items = [entry({ id: 'generic', title: 'Katalog Aplikasi (Default)', workspace_id: workspaceId })]
    expect(applicationCatalogEntriesToDisable(items, new Set([workspaceId])).map((item) => item.id)).toEqual(['generic'])
  })

  it('does not re-select catalogs that are already off', () => {
    const items = [
      entry({ id: 'generic', title: 'Application Catalog (Default)', is_active: false }),
      entry({ id: 'adira', title: ADIRA_APPLICATION_CATALOG_TITLE }),
    ]
    expect(applicationCatalogEntriesToDisable(items)).toEqual([])
  })

  it('does not treat application notes as the master catalog to disable', () => {
    const items = [entry({ id: 'notes', title: 'Application Notes (Default)' })]
    expect(applicationCatalogEntriesToDisable(items, new Set([ADIRA_FINANCE_WORKSPACE_KEY]))).toEqual([])
  })

  it('explains the portfolio source on the managed catalog and archived default catalog', () => {
    const items = [
      entry({ id: 'generic', title: 'Application Catalog (Default)' }),
      entry({ id: 'adira', title: ADIRA_APPLICATION_CATALOG_TITLE }),
    ]
    expect(applicationSourceNotice(items[1], items)).toContain('Official application list')
    expect(applicationSourceNotice(items[0], items)).toContain('Application source: portfolio')
    expect(shouldSkipDefaultApplicationCatalog(ADIRA_FINANCE_WORKSPACE_KEY, items)).toBe(true)
  })
})
