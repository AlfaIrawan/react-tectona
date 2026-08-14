import { describe, expect, it, beforeEach } from 'vitest'
import {
  acceptInboxWorkItem,
  countPendingInboxWorkItems,
  declineInboxWorkItem,
  filterNonInboxWorkItems,
  filterPendingInboxWorkItems,
  seedSampleInboxWorkItems,
} from './projectInboxWorkItems'
import { listPendingInboxWorkItemIds } from './projectInboxStore'
import { isWorkItemArchived } from './projectArchivedStore'
import { isWorkItemInPendingInbox } from './projectInboxStore'

const PROJECT_ID = '43cced1c-0000-4000-8000-000000000001'

function mockItem(idSuffix: string) {
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
    status: 'Backlog' as const,
    dueDate: '2026-08-01',
    dependencyStatus: 'Clear',
    progress: 0,
    estimatedHours: 0,
    actualHours: 0,
    lastUpdated: '2026-08-08T00:00:00.000Z',
  }
}

describe('projectInboxWorkItems', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('seeds sample inbox items on first visit', () => {
    const items = [
      mockItem('bug-vendor-api-gap'),
      mockItem('task-integration-blueprint'),
      mockItem('task-sla-draft'),
      mockItem('task-charter'),
    ]

    const seeded = seedSampleInboxWorkItems({
      projectId: PROJECT_ID,
      workItems: items,
    })

    expect(seeded).toBe(true)
    expect(filterPendingInboxWorkItems(items, PROJECT_ID)).toHaveLength(3)
    expect(filterNonInboxWorkItems(items, PROJECT_ID)).toHaveLength(1)
    expect(listPendingInboxWorkItemIds(PROJECT_ID)).toHaveLength(3)
  })

  it('accept removes item from inbox and restores delivery visibility', () => {
    const items = [mockItem('bug-vendor-api-gap'), mockItem('task-charter')]
    seedSampleInboxWorkItems({ projectId: PROJECT_ID, workItems: items })

    acceptInboxWorkItem(PROJECT_ID, items[0].id)
    expect(isWorkItemInPendingInbox(PROJECT_ID, items[0].id)).toBe(false)
    expect(filterNonInboxWorkItems(items, PROJECT_ID)).toHaveLength(2)
  })

  it('decline removes from inbox and archives the work item', () => {
    const items = [mockItem('task-sla-draft')]
    seedSampleInboxWorkItems({ projectId: PROJECT_ID, workItems: items })

    declineInboxWorkItem({
      projectId: PROJECT_ID,
      workItemId: items[0].id,
      declinedBy: 'ricky.gunawan',
    })

    expect(isWorkItemInPendingInbox(PROJECT_ID, items[0].id)).toBe(false)
    expect(isWorkItemArchived(PROJECT_ID, items[0].id)).toBe(true)
    expect(filterPendingInboxWorkItems(items, PROJECT_ID)).toHaveLength(0)
  })
})
