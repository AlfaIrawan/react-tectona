import { describe, expect, it } from 'vitest'
import {
  defaultPartChoices,
  isSystemFilledKey,
  keysToGenerate,
  mergePartChoices,
  templateParts,
  versionsNeeded,
  type PartPayload,
} from '@/modules/project-management/lib/templatePartSelection'

const schema = {
  placeholders: [
    { key: 'project_name', label: 'Project Name' },
    { key: 'deskripsi_proyek', label: 'Deskripsi Proyek' },
    { key: 'unit_bisnis', label: 'Unit Bisnis' },
    { key: 'docnum', label: 'DocNum' },
    { key: 'job_title', label: 'Job Title' },
    { key: 'process_flow', label: 'Process Flow' },
  ],
  sections: [{ id: 'background', heading: 'Background' }],
  repeaters: [
    { id: 'r1', collection: 'use_cases', kind: 'table' },
    { id: 'r2', collection: 'use_case_steps', kind: 'table', parent_collection: 'use_cases' },
  ],
}

const empty: PartPayload = { fills: {}, sections: {}, collections: {}, diagrams: {} }

describe('templateParts', () => {
  it('lists fields, sections and top-level tables, leaving out what the system fills', () => {
    expect(templateParts(schema).map((part) => `${part.kind}:${part.key}`)).toEqual([
      'field:deskripsi_proyek', 'field:unit_bisnis', 'field:process_flow', 'section:background', 'table:use_cases',
    ])
    expect(isSystemFilledKey('Project_Name')).toBe(true)
    expect(isSystemFilledKey('unit_bisnis')).toBe(false)
  })
})

describe('part choices', () => {
  const parts = templateParts(schema)
  const v6: PartPayload = {
    fills: { deskripsi_proyek: 'V6 deskripsi', unit_bisnis: 'Digital Banking', process_flow: 'Alur' },
    sections: {}, collections: { use_cases: [{ name: 'UC1' }] }, diagrams: { process_flow: 'png-v6' },
  }

  it('keeps what the current version has and generates the rest by default', () => {
    expect(defaultPartChoices(parts, v6)).toEqual({
      deskripsi_proyek: 'keep', unit_bisnis: 'keep', process_flow: 'keep', background: 'generate', use_cases: 'keep',
    })
  })

  it('merges generated parts with the kept and earlier-version parts', () => {
    const choices = { deskripsi_proyek: 2, unit_bisnis: 'generate', process_flow: 'keep', background: 'generate', use_cases: 'keep' } as const
    expect(keysToGenerate(parts, choices)).toEqual(['unit_bisnis', 'background'])
    expect(versionsNeeded(parts, choices, 6)).toEqual([2, 6])

    const v2: PartPayload = { ...empty, fills: { deskripsi_proyek: 'V2 deskripsi singkat' } }
    const generated: PartPayload = {
      fills: { unit_bisnis: 'CLV', project_name: 'Welcome Greeting', docnum: 'ITBP2026-00001' },
      sections: { background: '<p>Latar</p>' }, collections: {}, diagrams: {},
    }
    const { payload, missing } = mergePartChoices({ parts, choices, currentVersion: 6, generated, payloads: { 2: v2, 6: v6 } })

    expect(missing).toEqual([])
    expect(payload.fills).toEqual({
      unit_bisnis: 'CLV', project_name: 'Welcome Greeting', docnum: 'ITBP2026-00001',
      deskripsi_proyek: 'V2 deskripsi singkat', process_flow: 'Alur',
    })
    expect(payload.sections).toEqual({ background: '<p>Latar</p>' })
    expect(payload.collections).toEqual({ use_cases: [{ name: 'UC1' }] })
    expect(payload.diagrams).toEqual({ process_flow: 'png-v6' })
  })

  it('reports a part the chosen version does not have', () => {
    const choices = { deskripsi_proyek: 'keep', unit_bisnis: 'generate', process_flow: 'generate', background: 'keep', use_cases: 'generate' } as const
    const { missing } = mergePartChoices({ parts, choices, currentVersion: 6, generated: empty, payloads: { 6: v6 } })
    expect(missing.map((part) => part.key)).toEqual(['background'])
  })
})
