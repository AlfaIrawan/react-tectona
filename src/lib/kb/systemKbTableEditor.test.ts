import { describe, expect, it } from 'vitest'
import {
  defaultSystemKbTableHtml,
  parseSystemKbTableContent,
  serializeSystemKbTable,
  resolveSystemKbTableSpec,
} from './systemKbTableEditor'

describe('systemKbTableEditor', () => {
  it('resolves the AS-IS process template and keeps all four columns on round-trip', () => {
    const spec = resolveSystemKbTableSpec('Daftar Proses AS-IS (Default)')
    expect(resolveSystemKbTableSpec('AS-IS Process List (Default)')?.id).toBe('proses_as_is')
    expect(spec?.columns).toHaveLength(4)
    const html = defaultSystemKbTableHtml('proses_as_is')
    const parsed = parseSystemKbTableContent('Daftar Proses AS-IS (Default)', html)
    expect(parsed?.rows).toEqual([])
    expect(parsed?.intro).toContain('AS-IS process names')

    const withRow = {
      specId: 'proses_as_is' as const,
      intro: parsed!.intro,
      rows: [{
        process: 'Origination',
        owner: 'Credit Ops',
        apps: 'OneIn',
        pain: 'Manual SLA',
      }],
    }
    const saved = serializeSystemKbTable(withRow)
    const again = parseSystemKbTableContent('Daftar Proses AS-IS (Default)', saved)
    expect(again?.rows[0]).toEqual(withRow.rows[0])
    expect(saved).toContain('<th>Related applications</th>')
    expect(saved).toContain('<th>Pain point</th>')
  })

  it('pads missing cells when a drawer-cropped two-column table is loaded', () => {
    const html = [
      '<p>Inventaris nama proses AS-IS.</p>',
      '<table><thead><tr><th>Nama proses</th><th>Pemilik proses</th></tr></thead>',
      '<tbody><tr><td>Collections</td><td>Ops</td></tr></tbody></table>',
    ].join('')
    const parsed = parseSystemKbTableContent('Daftar Proses AS-IS (Default)', html)
    expect(parsed?.rows[0]).toEqual({
      process: 'Collections',
      owner: 'Ops',
      apps: '',
      pain: '',
    })
    expect(parsed?.intro).toContain('AS-IS process names')
  })

  it('maps a stored Indonesian glossary intro to the English framework notes', () => {
    const html = [
      '<p>Glosarium bisnis workspace ini. Tambah baris istilah di tabel. Matikan Pakai untuk AI jika kamus resmi sudah terhubung.</p>',
      '<table><thead><tr><th>Istilah</th><th>Definisi</th></tr></thead><tbody></tbody></table>',
    ].join('')
    const parsed = parseSystemKbTableContent('List Istilah (Default)', html)
    expect(parsed?.intro).toContain('Business glossary')
    expect(parsed?.intro).not.toContain('Glosarium')
  })

  it('resolves the org overlay template as a structured table', () => {
    const spec = resolveSystemKbTableSpec('Org Context (Default)')
    expect(spec?.columns.map((column) => column.key)).toEqual(['org_ref', 'alias', 'expertise', 'do_not_contact_for'])
    const html = defaultSystemKbTableHtml('org_overlay')
    const parsed = parseSystemKbTableContent('Org Context (Default)', html)
    expect(parsed?.intro).toContain('Workspace Org')
    expect(parsed?.rows).toEqual([])
  })

  it('resolves application notes as an overlay table, not a master catalog', () => {
    const spec = resolveSystemKbTableSpec('Application Notes (Default)')
    expect(spec?.id).toBe('app_notes')
    expect(spec?.columns).toHaveLength(4)
    const parsed = parseSystemKbTableContent('Catatan Aplikasi (Default)', defaultSystemKbTableHtml('app_notes'))
    expect(parsed?.intro).toContain('not a master catalog')
  })

  it('adds Description to the application catalog without shifting legacy rows', () => {
    const legacyHtml = [
      '<p>Application catalog.</p>',
      '<table><thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Status</th><th>Notes</th></tr></thead>',
      '<tbody><tr><td>adira.co.id</td><td>Website</td><td>Digital Team</td><td>Active</td><td>Public site</td></tr></tbody></table>',
    ].join('')
    const parsed = parseSystemKbTableContent('Application Catalog (Default)', legacyHtml)

    expect(parsed?.rows[0]).toEqual({
      name: 'adira.co.id',
      type: 'Website',
      description: '',
      tags: '',
      owner: 'Digital Team',
      status: 'Active',
      notes: 'Public site',
    })
  })
})
