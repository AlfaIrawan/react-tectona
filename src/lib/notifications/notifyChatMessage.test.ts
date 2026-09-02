import { describe, expect, it } from 'vitest'
import { claimIncomingChatNotificationKey } from './notifyChatMessage'

describe('claimIncomingChatNotificationKey', () => {
  it('accepts a new key and rejects a repeat within the window', () => {
    const key = `toast-test-${Date.now()}-${Math.random()}`
    expect(claimIncomingChatNotificationKey(key, 8_000)).toBe(true)
    expect(claimIncomingChatNotificationKey(key, 8_000)).toBe(false)
  })
})
