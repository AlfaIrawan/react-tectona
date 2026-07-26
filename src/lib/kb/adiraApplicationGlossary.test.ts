import { describe, expect, it } from 'vitest'
import {
  ADIRA_APPLICATIONS,
  ADIRA_APPLICATION_CATALOG_TITLE,
  ADIRA_FINANCE_WORKSPACE_KEY,
  buildAdiraApplicationCatalogKbContentHtml,
  buildAdiraApplicationKbContentHtml,
} from './adiraApplicationGlossary'

describe('adiraApplicationGlossary', () => {
  it('builds catalog html as table with all seven applications', () => {
    const html = buildAdiraApplicationCatalogKbContentHtml()
    expect(html).toContain(ADIRA_APPLICATION_CATALOG_TITLE)
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Aplikasi</th>')
    expect(html).toContain('<th>Category</th>')
    expect(html).toContain('<th>Ringkasan</th>')
    expect(html).not.toContain('<th>Kode</th>')
    expect(html).not.toContain('<th>Kelompok</th>')
    for (const app of ADIRA_APPLICATIONS) {
      expect(html).toContain(app.title)
    }
  })

  it('builds per-application profile html', () => {
    const html = buildAdiraApplicationKbContentHtml(ADIRA_APPLICATIONS[0])
    expect(html).toContain('<h2>Profil Aplikasi</h2>')
    expect(html).toContain('OneIn')
    expect(html).toContain('Category')
    expect(html).not.toContain('Kode')
    expect(html).toContain('Adira Finance')
  })

  it('lists exactly seven applications', () => {
    expect(ADIRA_APPLICATIONS).toHaveLength(7)
    expect(ADIRA_APPLICATIONS.map((app) => app.title)).toEqual([
      'OneIn',
      'OneEx',
      'ACCTION',
      'AMAN',
      'SAP FIORI',
      'SAP FICO',
      'SAP MM',
    ])
  })

  it('uses Adira Finance workspace key for glossary scope', () => {
    expect(ADIRA_FINANCE_WORKSPACE_KEY).toBe('AW-G6UC')
  })
})
