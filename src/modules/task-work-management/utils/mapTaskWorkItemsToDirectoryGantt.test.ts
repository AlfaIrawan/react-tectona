import { expect, it } from 'vitest'
import { normalizeGanttProjectName } from '@/modules/planning-scheduling/lib/planningGanttProjectName'
import { mapTaskWorkItemsToDirectoryGantt } from './mapTaskWorkItemsToDirectoryGantt'

it('keeps the Gantt fallback name for absent or whitespace-only projects', () => {
  expect(normalizeGanttProjectName()).toBe('Unidentified')
  expect(normalizeGanttProjectName('  \t ')).toBe('Unidentified')
  expect(normalizeGanttProjectName('  Project A  ')).toBe('Project A')
})

it('preserves normalized names, parent IDs, and list order in directory rows', () => {
  const item = { title: 'Work item', type: 'Task', workspace: 'QA', team: 'QA', assignee: '', owner: '', progress: 0 }
  const rows = mapTaskWorkItemsToDirectoryGantt([
    { ...item, id: 'parent', project: ' Project A ', dueDate: '2026-01-03' },
    { ...item, id: 'child', project: ' ', parentId: 'parent' },
  ])
  expect(rows.map(({ id, project, parentId, listOrder, type }) => ({ id, project, parentId, listOrder, type })))
    .toEqual([
      { id: 'parent', project: 'Project A', parentId: null, listOrder: 0, type: 'Milestone' },
      { id: 'child', project: 'Unidentified', parentId: 'parent', listOrder: 1, type: 'Workstream' },
    ])
})
