export type InviteNotifyKey = 'notifyEmail' | 'notifySlackTeams' | 'notifyGovernance' | 'notifyDelivery'

/** Email uses identity-lite SMTP (same path as signup verification). */
export function inviteNotifyChannelEnabled(
  key: InviteNotifyKey,
  smtpConfigured: boolean,
): boolean {
  return key === 'notifyEmail' && smtpConfigured
}

export function inviteNotifyPreferenceHint(smtpConfigured: boolean): string | null {
  if (smtpConfigured) {
    return 'Email uses the same Tectona SMTP as account verification. Slack / Teams, governance alerts, and delivery reminders will apply after those collaboration tools are connected.'
  }
  return 'Not available yet — notification channels will apply after your organization connects email and collaboration tools for workspace invitations.'
}
