import { describe, expect, it } from 'vitest'
import { hasOrganizationAdminAccess } from './platformAccess'

describe('hasOrganizationAdminAccess', () => {
  it('accepts identity-lite and AuthZ role aliases', () => {
    expect(hasOrganizationAdminAccess(['tectona_organization_admin'])).toBe(true)
    expect(hasOrganizationAdminAccess(['tectona.organization_admin'])).toBe(true)
    expect(hasOrganizationAdminAccess(['organization_admin'])).toBe(true)
    expect(hasOrganizationAdminAccess(['tectona_admin'])).toBe(false)
    expect(hasOrganizationAdminAccess([])).toBe(false)
  })
})
