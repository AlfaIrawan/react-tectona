import { describe, expect, it } from 'vitest'
import { reviewerDisplayName } from './reviewerDisplayName'

const GUID = '97e9ef1f-cb83-459b-a685-3496f5057ac2'
const directory: Record<string, string> = { [GUID]: 'Alfa Irawan' }
// Same contract as IdeaDetailPage.resolveIdentityDisplayName: unknown ids come back unchanged.
const resolve = (id: string) => directory[id] ?? id

describe('reviewerDisplayName', () => {
  it('names another reviewer from the identity directory', () => {
    expect(reviewerDisplayName(GUID, { userId: 'me', userName: 'Ricky', resolve })).toBe('Alfa Irawan')
  })

  it('never shows a GUID the directory cannot resolve', () => {
    expect(reviewerDisplayName('11111111-2222-3333-4444-555555555555', { userId: 'me', resolve })).toBe('another user')
    expect(reviewerDisplayName(GUID, { userId: 'me' })).toBe('another user')
  })

  it('uses the signed-in user name for their own revisions', () => {
    expect(reviewerDisplayName('me', { userId: 'me', userName: 'Ricky', resolve })).toBe('Ricky')
  })

  it('labels system-authored revisions', () => {
    expect(reviewerDisplayName('system', { resolve })).toBe('Tectona AI')
  })

  it('keeps readable non-GUID ids and handles empty input', () => {
    expect(reviewerDisplayName('checker-9', { resolve })).toBe('checker-9')
    expect(reviewerDisplayName('', { resolve })).toBe('')
  })
})
