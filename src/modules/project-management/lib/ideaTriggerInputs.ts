export const IDEA_TRIGGER_INPUTS_CONFIG = 'ideaTriggerInputs'
export const IDEA_INPUT_MAX_LENGTH = 255

export type IdeaTriggerInput = {
  key: string
  label: string
  workspace_id: string
  requirement: 'mandatory' | 'optional'
}

export function isIdeaIntakeTrigger(config: Record<string, string>) {
  return config.triggerType === 'Event' && config.triggerDomain === 'AI Idea & Prioritization'
    && config.triggerEntity === 'Idea' && config.triggerEvent === 'Before Idea Creation'
}

export function readIdeaTriggerInputs(value?: string): IdeaTriggerInput[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter((row): row is IdeaTriggerInput =>
      Boolean(row && typeof row.key === 'string' && typeof row.label === 'string'
        && typeof row.workspace_id === 'string' && ['mandatory', 'optional'].includes(row.requirement))) : []
  } catch { return [] }
}

export function inputsForWorkspace(fields: IdeaTriggerInput[] | undefined, workspaceId: string) {
  return (fields ?? []).filter((field) => field.workspace_id === workspaceId)
}

export function collectIdeaTriggerInputs(fields: IdeaTriggerInput[], draft: Record<string, string>) {
  const values: Record<string, string> = {}
  for (const field of fields) {
    const value = Object.hasOwn(draft, field.key) ? draft[field.key].trim() : ''
    if (!value && field.requirement === 'mandatory') return { values, error: `${field.label} is required.` }
    if (value.length > IDEA_INPUT_MAX_LENGTH) return { values, error: `${field.label} is too long.` }
    if (value) values[field.key] = value
  }
  return { values, error: null }
}
