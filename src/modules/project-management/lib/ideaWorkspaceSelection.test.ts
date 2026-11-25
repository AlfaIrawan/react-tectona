import { describe, expect, it } from 'vitest'
import { selectableIdeaWorkspaces, type IdeaWorkspaceSelectionPolicy } from './ideaWorkspaceSelection'

const policy: IdeaWorkspaceSelectionPolicy = { workflow_id: 'wf', allowed_workspace_ids: ['a', 'b'], default_workspace_id: 'b', selection_required: true, popup_title: 'Select Workspace' }

describe('Workspace Selection access intersection', () => {
  it('never offers configured workspaces outside the user accessible list', () => {
    expect(selectableIdeaWorkspaces([{ workspaceId: 'a' }, { workspaceId: 'c' }], policy)).toEqual([{ workspaceId: 'a' }])
  })
  it('returns no choices instead of falling back to an unconfigured workspace', () => {
    expect(selectableIdeaWorkspaces([{ workspaceId: 'c' }], policy)).toEqual([])
  })
})
