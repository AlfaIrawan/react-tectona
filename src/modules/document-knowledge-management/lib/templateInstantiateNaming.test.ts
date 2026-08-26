import { describe, expect, it } from 'vitest'

import { buildTemplateUploadNamingPlan } from './templateInstantiateNaming'

describe('template upload document prefix', () => {
  it('uses FSD for a hyphenated Functional Specification file name', () => {
    const plan = buildTemplateUploadNamingPlan({
      fileName: 'Tectona-Template-Functional-Specification-Design.docx',
      workspaceName: 'Adira Finance WS',
      namingRule: null,
      lastModified: new Date('2026-08-16T00:00:00Z').getTime(),
    })

    expect(plan.documentKind).toBe('fsd')
    expect(plan.effectiveFileName).toMatch(/^FSD_/)
  })

  it('uses FSD when an ambiguous file name contains FSD content', () => {
    const plan = buildTemplateUploadNamingPlan({
      fileName: 'Enterprise-Template.docx',
      workspaceName: 'Adira Finance WS',
      namingRule: null,
      documentText: 'Functional Specification Design (FSD)\n4. Spesifikasi Functional',
      lastModified: new Date('2026-08-16T00:00:00Z').getTime(),
    })

    expect(plan.documentKind).toBe('fsd')
    expect(plan.effectiveFileName).toMatch(/^FSD_/)
  })
})
