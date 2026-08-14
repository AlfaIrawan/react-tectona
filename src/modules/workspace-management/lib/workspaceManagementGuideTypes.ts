export type WorkspaceGuideActionId =
  | 'add-new-workspace'
  | 'view-workspace-details'
  | 'assign-governance'
  | 'add-member'
  | 'link-projects'
  | 'rename-workspace'
  | 'edit-workspace'
  | 'delete-workspace'

export type WorkspaceGuideWorkspace = {
  id: string
  name: string
  code: string
}

export const WORKSPACE_PICKER_ACTIONS: WorkspaceGuideActionId[] = [
  'view-workspace-details',
  'assign-governance',
  'add-member',
  'link-projects',
  'rename-workspace',
  'edit-workspace',
  'delete-workspace',
]

export const WORKSPACE_GUIDE_ACTION_LABELS: Record<WorkspaceGuideActionId, string> = {
  'add-new-workspace': 'Add New Workspace',
  'view-workspace-details': 'View Workspace Details',
  'assign-governance': 'Assign Governance',
  'add-member': 'Add Member in Workspace',
  'link-projects': 'Link Projects',
  'rename-workspace': 'Rename Workspace',
  'edit-workspace': 'Edit Workspace',
  'delete-workspace': 'Delete Workspace',
}

export const WORKSPACE_GUIDE_PICKER_DESCRIPTIONS: Record<
  Exclude<WorkspaceGuideActionId, 'add-new-workspace'>,
  string
> = {
  'view-workspace-details': 'Choose which workspace you want to view.',
  'assign-governance': 'Choose which workspace you want to assign governance to.',
  'add-member': 'Choose which workspace you want to add a member to.',
  'link-projects': 'Choose which workspace you want to link projects for.',
  'rename-workspace': 'Choose which workspace you want to rename.',
  'edit-workspace': 'Choose which workspace you want to edit.',
  'delete-workspace': 'Choose which workspace you want to delete.',
}
