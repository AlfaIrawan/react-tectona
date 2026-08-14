import { describe, expect, it } from 'vitest'
import { buildTenantUiProfile, shouldHideKnowledgeBaseSection } from './tenantUiProfile'

describe('tenantUiProfile — DKM navigation', () => {
  it('never hides Knowledge intelligence dashboard / Knowledge Base integration', () => {
    const corporatePersonal = {
      tenantMode: 'personal' as const,
      isPlatformAdmin: false,
      isCorporateUser: true,
      isAllWorkspaces: false,
    }
    const corporateOrg = {
      tenantMode: 'organization' as const,
      isPlatformAdmin: false,
      isCorporateUser: true,
      isAllWorkspaces: true,
    }

    expect(shouldHideKnowledgeBaseSection(corporatePersonal)).toBe(false)
    expect(shouldHideKnowledgeBaseSection(corporateOrg)).toBe(false)
    expect(buildTenantUiProfile(corporatePersonal).hideKnowledgeBaseSection).toBe(false)
    expect(buildTenantUiProfile(corporateOrg).hideKnowledgeBaseSection).toBe(false)
  })
})
