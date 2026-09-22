import { describe, expect, it } from 'vitest'
import {
  displaySystemKbEntryTitle,
  findIdeaIntakeChecklistDefaultEntry,
  isIdeaIntakeChecklistTitle,
  isLockedSystemKbEntry,
  isPlatformWideSystemKbEntry,
  isSystemKbEntry,
  isSystemKbEntryTitle,
  planWorkspaceSystemKbDedupe,
  withoutDuplicateWorkspaceSystemKbEntries,
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
    expect(isSystemKbEntryTitle('List Istilah (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Glossary (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('List Singkatan (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Abbreviation List (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Katalog Aplikasi (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Application Catalog (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Stakeholder & RACI (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Daftar Proses AS-IS (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('AS-IS Process List (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Aturan Penyebutan (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Naming Rules (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Org Context (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Konteks Org (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Application Notes (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('Catatan Aplikasi (Default)')).toBe(true)
    expect(isSystemKbEntryTitle('KB Naming Standard')).toBe(true)
    expect(isSystemKbEntryTitle('Make Structured AI Capability')).toBe(true)
    expect(isSystemKbEntryTitle('Make Structured AI Prompt Template')).toBe(true)
    expect(isSystemKbEntryTitle('Katalog Aplikasi Adira Finance')).toBe(false)
  })

  it('keeps the intake checklist and naming standard as platform-wide system rows', () => {
    expect(isIdeaIntakeChecklistTitle('Idea Intake Checklist (Default)')).toBe(true)
    expect(isPlatformWideSystemKbEntry({ title: 'List Istilah (Default)', workspace_id: 'ws-1' })).toBe(false)
    expect(displaySystemKbEntryTitle('List Istilah (Default)')).toBe('Glossary (Default)')
    expect(displaySystemKbEntryTitle('Daftar Proses AS-IS (Default)')).toBe('AS-IS Process List (Default)')
    expect(displaySystemKbEntryTitle('Konteks Org (Default)')).toBe('Org Context (Default)')
    expect(displaySystemKbEntryTitle('Catatan Aplikasi (Default)')).toBe('Application Notes (Default)')
    expect(isPlatformWideSystemKbEntry({ title: 'Idea Intake Checklist (Default)', workspace_id: null })).toBe(true)
    expect(isPlatformWideSystemKbEntry({ title: 'KB Naming Standard', workspace_id: null })).toBe(true)
    expect(isPlatformWideSystemKbEntry({ title: 'Make Structured AI Capability', workspace_id: null })).toBe(true)
    expect(isLockedSystemKbEntry({ title: 'KB Naming Standard' })).toBe(true)
    expect(isLockedSystemKbEntry({ title: 'Make Structured AI Capability' })).toBe(true)
    expect(isLockedSystemKbEntry({ title: 'Make Structured AI Prompt Template' })).toBe(true)
    expect(isLockedSystemKbEntry({ title: 'Application Catalog (Default)' })).toBe(false)
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

  it('keeps one System template per workspace when an English rename sits beside the old title', () => {
    const workspaceId = 'ws-ricky'
    const rows = [
      entry({
        id: 'as-is-new',
        title: 'AS-IS Process List (Default)',
        workspace_id: workspaceId,
        content: '<p>short</p>',
        updated_at: '2026-08-31T04:19:00Z',
      }),
      entry({
        id: 'as-is-old',
        title: 'Daftar Proses AS-IS (Default)',
        workspace_id: workspaceId,
        content: '<p>AS-IS process names (not full SOPs). longer original body</p>',
        updated_at: '2026-08-30T23:55:00Z',
      }),
      entry({
        id: 'naming-new',
        title: 'Naming Rules (Default)',
        workspace_id: workspaceId,
        content: '<p>short</p>',
        updated_at: '2026-08-31T04:19:00Z',
      }),
      entry({
        id: 'naming-old',
        title: 'Aturan Penyebutan (Default)',
        workspace_id: workspaceId,
        content: '<p>Official naming and spelling so AI output stays consistent. longer</p>',
        updated_at: '2026-08-30T23:55:00Z',
      }),
    ]
    const plan = planWorkspaceSystemKbDedupe(rows)
    expect(plan).toHaveLength(2)
    expect(plan.map((item) => item.keeper.id).sort()).toEqual(['as-is-old', 'naming-old'])
    expect(withoutDuplicateWorkspaceSystemKbEntries(rows).map((item) => item.id).sort()).toEqual(['as-is-old', 'naming-old'])
  })

  it('treats the legacy Adira workspace alias and WAC UUID as the same workspace', () => {
    const rows = [
      entry({
        id: 'catalog-empty',
        title: 'Application Catalog (Default)',
        workspace_id: '00000000-0000-0000-0001-000000000100',
        content: '<p>Application catalog</p><table><tbody></tbody></table>',
        updated_at: '2026-09-20T04:15:45Z',
      }),
      entry({
        id: 'catalog-with-data',
        title: 'Application Catalog (Default)',
        workspace_id: 'ADIRA-FINANCE-WS',
        content: '<p>Application catalog</p><table><tbody><tr><td>ACCTION</td><td>Web</td></tr></tbody></table>',
        updated_at: '2026-09-19T16:34:33Z',
      }),
    ]

    const plan = planWorkspaceSystemKbDedupe(rows)

    expect(plan).toHaveLength(1)
    expect(plan[0].keeper.id).toBe('catalog-with-data')
    expect(plan[0].extras.map((item) => item.id)).toEqual(['catalog-empty'])
    expect(plan[0].canonicalWorkspaceId).toBe('00000000-0000-0000-0001-000000000100')
  })
})
