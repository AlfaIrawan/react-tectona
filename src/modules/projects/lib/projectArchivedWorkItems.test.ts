import { describe, expect, it, beforeEach } from 'vitest'
import {
  archiveWorkItemsManual,
  filterActiveWorkItems,
  filterArchivedWorkItems,
  isWorkItemArchivable,
  restoreArchivedWorkItem,
  seedSampleArchivedWorkItems,
} from './projectArchivedWorkItems'

const PROJECT_ID = '43cced1c-0000-4000-8000-000000000001'

function mockItem(idSuffix: string, status = 'Done') {
  const prefix = 'PT-43CCED1C'
  return {
    id: `${prefix}-${idSuffix}`,
    title: idSuffix,
    type: 'Task' as const,
    project: 'Wakatobi',
    workspace: 'Tectona Workspace',
    assignee: 'ricky.gunawan',
    owner: 'ricky.gunawan',
    role: 'Contributor',
    team: 'Delivery Squad',
    priority: 'High' as const,
    status: status as 'Done' | 'In Progress',
    dueDate: '2026-08-01',
    dependencyStatus: 'Clear',
    progress: 100,
    estimatedHours: 0,
    actualHours: 0,
    lastUpdated: '2026-08-08T00:00:00.000Z',
  }
}

describe('projectArchivedWorkItems', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('seeds sample archived done tasks on first visit', () => {
    const items = [
      mockItem('task-charter'),
      mockItem('task-business-case'),
      mockItem('task-vendor-evaluation', 'In Progress'),
    ]

    const seeded = seedSampleArchivedWorkItems({
      projectId: PROJECT_ID,
      workItems: items,
      archivedBy: 'ricky.gunawan',
      projectCreatedAt: '2026-08-08T00:00:00.000Z',
    })

    expect(seeded).toBe(true)
    expect(filterArchivedWorkItems(items, PROJECT_ID)).toHaveLength(2)
    expect(filterActiveWorkItems(items, PROJECT_ID)).toHaveLength(1)
  })

  it('restores archived item back to active pool', () => {
    const items = [mockItem('task-charter'), mockItem('task-rfp-published')]
    seedSampleArchivedWorkItems({
      projectId: PROJECT_ID,
      workItems: items,
      archivedBy: 'ricky.gunawan',
    })

    restoreArchivedWorkItem(PROJECT_ID, items[0].id)
    expect(filterActiveWorkItems(items, PROJECT_ID)).toHaveLength(1)
    expect(filterArchivedWorkItems(items, PROJECT_ID)).toHaveLength(1)
  })

  it('archives only Done items manually from bulk action', () => {
    const items = [
      mockItem('task-charter'),
      mockItem('task-vendor-evaluation', 'In Progress'),
    ]

    const result = archiveWorkItemsManual({
      projectId: PROJECT_ID,
      workItemIds: items.map((item) => item.id),
      workItems: items,
      archivedBy: 'ricky.gunawan',
    })

    expect(result.archivedIds).toEqual([items[0].id])
    expect(result.skippedIds).toEqual([items[1].id])
    expect(isWorkItemArchivable(items[0])).toBe(true)
    expect(isWorkItemArchivable(items[1])).toBe(false)
    expect(filterActiveWorkItems(items, PROJECT_ID)).toHaveLength(1)
  })
})