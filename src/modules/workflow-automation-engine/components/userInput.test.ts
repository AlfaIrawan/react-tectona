import { describe, expect, it } from 'vitest'
import { WORKFLOW_KIND_META, WORKFLOW_PALETTE_ORDER, isWorkspaceSelectionInput, workflowNodeSummary } from './workflowNodeKinds'

describe('User Input nodes', () => {
  it('offers the generic node while retaining legacy definition support', () => {
    expect(WORKFLOW_PALETTE_ORDER).toContain('userInput')
    expect(WORKFLOW_PALETTE_ORDER).not.toContain('workspaceSelection')
    expect(WORKFLOW_KIND_META.workspaceSelection.label).toBe('User Input')
  })
  it('recognizes workspace inputs and rejects unsupported input types', () => {
    expect(isWorkspaceSelectionInput({ kind: 'userInput', config: { inputType: 'Workspace Selection' } })).toBe(true)
    expect(isWorkspaceSelectionInput({ kind: 'workspaceSelection', config: {} })).toBe(true)
    expect(isWorkspaceSelectionInput({ kind: 'userInput', config: { inputType: 'Unknown' } })).toBe(false)
    expect(workflowNodeSummary({ kind: 'userInput', label: 'Select Workspace', config: { ...WORKFLOW_KIND_META.userInput.defaultConfig, allowedWorkspaceIds: '["a","b"]' } })).toBe('2 workspace(s) available')
  })
})
