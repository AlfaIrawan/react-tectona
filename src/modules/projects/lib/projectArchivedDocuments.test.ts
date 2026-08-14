import { describe, expect, it, beforeEach } from 'vitest'
import type { RepositoryItem } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import {
  archiveDocumentManual,
  filterActiveRepositoryItems,
  listArchivedDocumentRows,
  restoreArchivedDocument,
} from './projectArchivedDocuments'
import { isDocumentArchived } from './projectArchivedDocumentStore'

const PROJECT_ID = '43cced1c-0000-4000-8000-000000000002'

function mockRepositoryItem(idSuffix: string): RepositoryItem {
  return {
    id: `doc-${idSuffix}`,
    name: `Document ${idSuffix}`,
    fileName: `${idSuffix}.pdf`,
    type: 'PDF',
    capabilityCode: 'delivery',
    capability: 'Delivery',
    linkedContext: 'Project charter',
    owner: 'ricky.gunawan',
    version: 'v1',
    documentVersion: 1,
    status: 'Published',
    tags: [],
    updated: '2026-08-08T00:00:00.000Z',
    accessScope: 'Project',
    workspace: 'Tectona Workspace',
    project: 'Wakatobi',
    linkedTask: '-',
    versionStatus: 'Current',
    category: 'General',
    detailId: `detail-${idSuffix}`,
    storageProjectId: PROJECT_ID,
    storageProjectName: 'Wakatobi',
    primaryAttachmentId: null,
    folderId: 'folder-1',
    templateId: null,
    updatedAt: '2026-08-08T00:00:00.000Z',
  }
}

describe('projectArchivedDocuments', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('archives a document and hides it from active list', () => {
    const items = [mockRepositoryItem('charter'), mockRepositoryItem('rfp')]

    archiveDocumentManual({
      projectId: PROJECT_ID,
      item: items[0],
      archivedBy: 'ricky.gunawan',
    })

    expect(isDocumentArchived(PROJECT_ID, items[0].id)).toBe(true)
    expect(filterActiveRepositoryItems(items, PROJECT_ID)).toHaveLength(1)
    expect(filterActiveRepositoryItems(items, PROJECT_ID)[0].id).toBe(items[1].id)
    expect(listArchivedDocumentRows(PROJECT_ID)).toHaveLength(1)
  })

  it('restores archived document back to active pool', () => {
    const items = [mockRepositoryItem('charter')]
    archiveDocumentManual({
      projectId: PROJECT_ID,
      item: items[0],
      archivedBy: 'ricky.gunawan',
    })

    restoreArchivedDocument(PROJECT_ID, items[0].id)
    expect(isDocumentArchived(PROJECT_ID, items[0].id)).toBe(false)
    expect(filterActiveRepositoryItems(items, PROJECT_ID)).toHaveLength(1)
    expect(listArchivedDocumentRows(PROJECT_ID)).toHaveLength(0)
  })
})
