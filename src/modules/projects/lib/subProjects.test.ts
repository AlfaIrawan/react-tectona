import { describe, expect, it } from 'vitest'
import type { WorkItemApiModel } from '@/lib/api/workApi'
import { isProgramProject, summarizeWorkItems } from './subProjects'

function item(status: WorkItemApiModel['status'], dueDate: string): WorkItemApiModel {
  return { status, dueDate } as WorkItemApiModel
}

describe('summarizeWorkItems', () => {
  const today = new Date('2026-10-17T08:00:00Z')

  it('counts done, in review and overdue (open items past due only)', () => {
    const summary = summarizeWorkItems(
      [
        item('Done', '2026-10-01'), // done items are never overdue
        item('In Review', '2026-10-10'), // in review and overdue
        item('In Progress', '2026-10-17'), // due today is not overdue
        item('To Do', '2026-11-01'),
      ],
      today,
    )
    expect(summary).toEqual({ total: 4, done: 1, inReview: 1, overdue: 1, donePct: 25 })
  })

  it('reports 0% for an empty sub-project', () => {
    expect(summarizeWorkItems([], today)).toEqual({ total: 0, done: 0, inReview: 0, overdue: 0, donePct: 0 })
  })
})

describe('isProgramProject', () => {
  it('is a program only when top-level with sub-projects', () => {
    expect(isProgramProject({ childProjectCount: 2, parentProjectId: null })).toBe(true)
    expect(isProgramProject({ childProjectCount: 0, parentProjectId: null })).toBe(false)
    expect(isProgramProject({ childProjectCount: 0, parentProjectId: 'p1' })).toBe(false)
  })
})
