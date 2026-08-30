import { describe, expect, it } from 'vitest'

import {
  inviteNotifyChannelEnabled,
  inviteNotifyPreferenceHint,
} from './inviteNotificationChannels'

describe('inviteNotifyChannelEnabled', () => {
  it('enables email only when identity-lite SMTP is configured', () => {
    expect(inviteNotifyChannelEnabled('notifyEmail', false)).toBe(false)
    expect(inviteNotifyChannelEnabled('notifyEmail', true)).toBe(true)
    expect(inviteNotifyChannelEnabled('notifySlackTeams', true)).toBe(false)
    expect(inviteNotifyChannelEnabled('notifyGovernance', true)).toBe(false)
    expect(inviteNotifyChannelEnabled('notifyDelivery', true)).toBe(false)
  })
})

describe('inviteNotifyPreferenceHint', () => {
  it('explains remaining channels when SMTP is already connected', () => {
    const hint = inviteNotifyPreferenceHint(true)
    expect(hint).toContain('SMTP')
    expect(hint).toContain('Slack')
  })
})
