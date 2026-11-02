import { describe, expect, it } from 'vitest'
import { ideaDocsFolderErrorMessage } from './ideaDocsFolderError'

describe('idea folder errors', () => {
  it('explains WAC failure without exposing the raw response', () => {
    const message = ideaDocsFolderErrorMessage(new Error('{"detail":"workspace access control unavailable"}'))
    expect(message).toContain('permission check')
    expect(message).not.toContain('detail')
    expect(message).not.toContain('{')
  })
  it('keeps denied access distinct from dependency failure', () => {
    expect(ideaDocsFolderErrorMessage(new Error('workspace access forbidden'))).toContain('do not have permission')
    expect(ideaDocsFolderErrorMessage(new Error('service token is not configured'))).toContain('configuration')
  })
  it('does not print arbitrary internal errors', () => {
    expect(ideaDocsFolderErrorMessage(new Error('internal secret data'))).not.toContain('secret')
    expect(ideaDocsFolderErrorMessage(null)).toContain('Try again')
  })
})
