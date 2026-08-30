import { describe, expect, it } from 'vitest'
import {
  findIdeaIntakeChecklistDefaultEntry,
  isSystemKbEntry,
  isSystemKbEntryTitle,
} from './systemKbEntry'
import type { KbEntryResponse } from '@/lib/api/tectonaKbApi'

function entry(partial: Partial<KbEntryResponse> & Pick<KbEntryResponse, 'title'>): KbEntryResponse {
  return {
    id: partial.id ?? 'kb-1',
    category: partial.category ?? 'idea_intake_checklist',
    title: partial.title,
    content: partial.content ?? '{}',
    is_active: partial.is_active ?? true,
    priority: partial.priority ?? 100,
    workspace_id: partial.workspace_id ?? null,
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

describe('systemKbEntry', () => {
  it('recognizes the default idea intake checklist title in either casing', () => {
    expect(isSystemKbEntryTitle('Idea Intake Checklist (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Idea intake checklist (default)')).toBe(true)
    expect(isSystemKbEntryTitle('Idea intake checklist')).toBe(true)
    expect(isSystemKbEntryTitle('Adira Finance Company Overview')).toBe(false)
  })

  it('treats the seeded default as a system entry even when tagged to one workspace', () => {
    expect(isSystemKbEntry({
      title: 'Idea intake checklist (default)',
      category: 'idea_intake_checklist',
    })).toBe(true)
    expect(isSystemKbEntry({
      title: 'Custom AS-IS questions',
      category: 'idea_intake_checklist',
    })).toBe(false)
  })

  it('finds the default among mixed catalog rows', () => {
    const found = findIdeaIntakeChecklistDefaultEntry([
      entry({ id: 'a', title: 'Company Overview', category: 'platform_context' }),
      entry({
        id: 'sys',
        title: 'Idea Intake Checklist (Default)',
        workspace_id: '00000000-0000-0000-0001-000000000100',
      }),
    ])
    expect(found?.id).toBe('sys')
  })
})
