import { describe, expect, it } from 'vitest'
import { stripGuidsFromKbDisplayText, stripGuidsFromKbHtml } from './kbDisplayText'

describe('kbDisplayText', () => {
  it('keeps a role name and drops the principal UUID from an assignment title', () => {
    expect(stripGuidsFromKbDisplayText('00000000-0000-0000-0000-000000000013 — Workspace Admin')).toBe('Workspace Admin')
    expect(stripGuidsFromKbDisplayText('f902fb3d-52df-47f0-98ea-b48e36eab2dd — Platform Admin (Personal Workspace)')).toBe(
      'Platform Admin (Personal Workspace)',
    )
  })

  it('drops UUIDs from assignment summaries', () => {
    const summary = stripGuidsFromKbDisplayText(
      'Role Assignment Principal — 00000000-0000-0000-0000-000000000013 Role — Workspace Admin',
    )
    expect(summary).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i)
    expect(summary).toContain('Workspace Admin')
  })

  it('leaves system template titles unchanged', () => {
    expect(stripGuidsFromKbDisplayText('AS-IS Process List (Default)')).toBe('AS-IS Process List (Default)')
  })

  it('strips UUIDs from role-assignment HTML', () => {
    const html = '<li><strong>Principal</strong> — 00000000-0000-0000-0000-000000000013</li>'
    expect(stripGuidsFromKbHtml(html)).not.toMatch(/00000000-0000-0000-0000-000000000013/)
  })
})
