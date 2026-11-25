import { describe, expect, it } from 'vitest'
import { normalizeUserDisplayName, topbarAccountDisplayName } from './userDisplayName'

describe('topbarAccountDisplayName', () => {
  it('shortens only the exact legacy account label', () => {
    expect(topbarAccountDisplayName('Development Administrator')).toBe('Administrator')
    expect(normalizeUserDisplayName('Development Administrator')).toBe('Development Administrator')
  })

  it('preserves the usual display normalization for other names', () => {
    for (const name of ['Development Administrator Asia', 'Development Admin', 'dev.admin@example.com', 'Ricky Gunawan', 'development administrator']) {
      expect(topbarAccountDisplayName(name)).toBe(normalizeUserDisplayName(name))
    }
  })
})
