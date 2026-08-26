import { describe, expect, it } from 'vitest'
import {
  addPersonAliasToKbHtml,
  buildAgentActionState,
  formatActionPayloadPreview,
} from './tectonaAgentActions'

describe('tectonaAgentActions', () => {
  it('builds pending execution map', () => {
    const state = buildAgentActionState([
      {
        action_id: 'a1',
        action_code: 'workspace.create',
        summary: 'Buat workspace',
        payload: { name: 'Portal SSO' },
      },
    ])
    expect(state.executions.a1?.status).toBe('pending')
  })

  it('formats payload preview rows', () => {
    const rows = formatActionPayloadPreview({
      action_id: 'a1',
      action_code: 'workspace.create',
      summary: 'Buat workspace',
      payload: { name: 'Portal SSO', workspace_key: 'portal-sso' },
    })
    expect(rows.some((r) => r.label === 'Name' && r.value === 'Portal SSO')).toBe(true)
  })

  it('formats payload preview rows for a document chat-edit apply action', () => {
    const rows = formatActionPayloadPreview({
      action_id: 'a1',
      action_code: 'document.apply_chat_edit',
      summary: 'Terapkan hasil transformasi ke bagian "Tujuan" di dokumen.',
      payload: {
        document_id: 'doc-1',
        section_title: 'Tujuan',
        location: { table_index: 0, row_index: 0 },
        original_text: 'Meningkatkan efisiensi transaksi pembayaran.',
        proposed_text: '- Meningkatkan efisiensi transaksi pembayaran.',
      },
    })
    expect(rows.some((r) => r.label === 'Section' && r.value === 'Tujuan')).toBe(true)
    expect(rows.some((r) => r.label === 'New content' && r.value.includes('Meningkatkan efisiensi'))).toBe(true)
  })

  it('adds a person alias after the canonical name field', () => {
    const updated = addPersonAliasToKbHtml(
      '<h3>Ringkasan</h3><ul><li><strong>Nama:</strong> Swandajani Gunadi</li></ul>',
      'Bu Swan',
    )

    expect(updated).toContain('<strong>Nama Panggilan:</strong> Bu Swan')
  })

  it('does not duplicate an existing person alias', () => {
    const original =
      '<ul><li><strong>Nama:</strong> Swandajani Gunadi</li><li><strong>Nama Panggilan:</strong> Bu Swan</li></ul>'
    const updated = addPersonAliasToKbHtml(original, 'Bu Swan')

    expect((updated.match(/Bu Swan/g) ?? []).length).toBe(1)
  })

  it('formats a person alias knowledge action for confirmation', () => {
    const rows = formatActionPayloadPreview({
      action_id: 'knowledge-1',
      action_code: 'knowledge.person_alias.add',
      summary: 'Simpan alias Bu Swan',
      payload: { canonical_name: 'Swandajani Gunadi', alias: 'Bu Swan' },
    })

    expect(rows).toEqual([
      { label: 'Profil', value: 'Swandajani Gunadi' },
      { label: 'Alias baru', value: 'Bu Swan' },
    ])
  })
})
