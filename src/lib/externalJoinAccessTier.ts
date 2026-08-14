/** Admin grant tier when approving external join requests to an org workspace. */

export type ExternalJoinAccessTier = 'organization_member' | 'workspace_member'

export type ExternalJoinAccessTierOption = {
  id: ExternalJoinAccessTier
  label: string
  description: string
}

export const EXTERNAL_JOIN_ACCESS_TIER_OPTIONS: ExternalJoinAccessTierOption[] = [
  {
    id: 'organization_member',
    label: 'Member Organization',
    description: 'Masuk dalam tree organisasi — personal workspace tampil di bawah Adira Finance WS.',
  },
  {
    id: 'workspace_member',
    label: 'Member Workspace Organization',
    description: 'Akses workspace Adira Finance saja — tanpa entri tree organisasi.',
  },
]

export function externalJoinAccessTierLabel(tier: ExternalJoinAccessTier): string {
  return EXTERNAL_JOIN_ACCESS_TIER_OPTIONS.find((o) => o.id === tier)?.label ?? tier
}
