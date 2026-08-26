import type { ParticipationScopeOption } from '@/lib/workspaceParticipationScopes'

export type InviteWorkspaceGovernanceSnapshot = {
  configurationStatus: 'Governed' | 'Partial' | 'Unconfigured' | 'Non-Compliant'
  complianceStatus: 'Compliant' | 'Needs Review' | 'Non-Compliant' | 'Unconfigured'
  policyStatus: 'Governed' | 'Draft Policy' | 'Non-Compliant' | 'Deprecated' | null
  template: string
  lastReview: string
}

export type InviteMemberGovernancePostureInput = {
  selectedWorkspaces: InviteWorkspaceGovernanceSnapshot[]
  workspaceRole: string
  participationDuration: '' | 'Permanent' | 'Temporary'
  participationScopeCode: string
  participationScopeOptions: ParticipationScopeOption[]
  requestedByName: string
}

export type GovernancePostureCardModel = {
  label: string
  value: string
  tone: 'default' | 'success' | 'info' | 'warning'
}

export type InviteMemberActivityAuditModel = {
  invitationSource: string
  requestedBy: string
  approvalRequirement: string
  lastPolicySync: string
}

const CONFIG_RANK: Record<InviteWorkspaceGovernanceSnapshot['configurationStatus'], number> = {
  Governed: 0,
  Partial: 1,
  Unconfigured: 2,
  'Non-Compliant': 3,
}

function isMissingGovernanceValue(value: string): boolean {
  const t = value.trim()
  return t.length === 0 || t === '-' || t.includes('\uFFFD')
}

function worstConfigurationStatus(
  workspaces: InviteWorkspaceGovernanceSnapshot[]
): InviteWorkspaceGovernanceSnapshot['configurationStatus'] | null {
  if (workspaces.length === 0) return null
  return workspaces.reduce((worst, w) =>
    CONFIG_RANK[w.configurationStatus] > CONFIG_RANK[worst.configurationStatus] ? w : worst
  ).configurationStatus
}

function allSameConfigurationStatus(workspaces: InviteWorkspaceGovernanceSnapshot[]): boolean {
  if (workspaces.length <= 1) return true
  const first = workspaces[0].configurationStatus
  return workspaces.every((w) => w.configurationStatus === first)
}

function workspaceGovernanceLabel(
  status: InviteWorkspaceGovernanceSnapshot['configurationStatus'] | null,
  workspaces: InviteWorkspaceGovernanceSnapshot[]
): { value: string; tone: GovernancePostureCardModel['tone'] } {
  if (!status) {
    return { value: 'Select a workspace to preview', tone: 'default' }
  }
  if (workspaces.length > 1 && !allSameConfigurationStatus(workspaces)) {
    return { value: 'Varies by workspace', tone: 'info' }
  }
  switch (status) {
    case 'Governed':
      return { value: 'Under active governance', tone: 'success' }
    case 'Partial':
      return { value: 'Governance in progress', tone: 'info' }
    case 'Unconfigured':
      return { value: 'Governance not configured', tone: 'warning' }
    case 'Non-Compliant':
      return { value: 'Attention required', tone: 'warning' }
    default:
      return { value: 'Unknown', tone: 'default' }
  }
}

function participationRiskLabel(input: InviteMemberGovernancePostureInput): {
  value: string
  tone: GovernancePostureCardModel['tone']
} {
  if (!input.workspaceRole) {
    return { value: 'Select role to preview', tone: 'default' }
  }
  let score = 0
  const normalizedRole = input.workspaceRole.toLowerCase()
  if (normalizedRole.includes('admin') || normalizedRole.includes('owner')) score += 3
  else if (normalizedRole.includes('manager') || normalizedRole.includes('editor')) score += 2
  else if (normalizedRole.includes('member')) score += 1

  if (input.participationDuration === 'Temporary') score += 1

  const worst = worstConfigurationStatus(input.selectedWorkspaces)
  if (worst === 'Non-Compliant') score += 2
  else if (worst === 'Unconfigured') score += 1

  const scope = input.participationScopeCode
  if (scope === 'all' || scope === 'all_projects') score += 1

  if (score >= 5) return { value: 'High', tone: 'warning' }
  if (score >= 3) return { value: 'Medium', tone: 'info' }
  return { value: 'Low', tone: 'success' }
}

function auditVisibilityLabel(
  workspaces: InviteWorkspaceGovernanceSnapshot[]
): { value: string; tone: GovernancePostureCardModel['tone'] } {
  const worst = worstConfigurationStatus(workspaces)
  if (!worst) return { value: 'Select a workspace to preview', tone: 'default' }
  if (worst === 'Non-Compliant') {
    return { value: 'Enabled — review required', tone: 'warning' }
  }
  if (worst === 'Unconfigured') {
    return { value: 'Limited until policies are set', tone: 'warning' }
  }
  if (worst === 'Partial') {
    return { value: 'Partial traceability', tone: 'info' }
  }
  const allCompliant = workspaces.every((w) => w.complianceStatus === 'Compliant')
  if (allCompliant) {
    return { value: 'Full traceability', tone: 'success' }
  }
  return { value: 'Enabled', tone: 'success' }
}

function participationScopeDisplay(
  options: ParticipationScopeOption[],
  code: string
): string {
  if (!code.trim()) return 'Select participation scope'
  const label = options.find((o) => o.value === code)?.label?.trim()
  if (label) return label
  return code.replace(/_/g, ' ')
}

function parseReviewDate(lastReview: string): Date | null {
  const t = lastReview.trim()
  if (isMissingGovernanceValue(t)) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatRelativePolicySync(lastReview: string): string {
  const d = parseReviewDate(lastReview)
  if (!d) return 'Not recorded'
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return d.toLocaleDateString()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`
  return d.toLocaleDateString()
}

function latestPolicyReview(workspaces: InviteWorkspaceGovernanceSnapshot[]): string {
  let best: Date | null = null
  for (const w of workspaces) {
    const d = parseReviewDate(w.lastReview)
    if (!d) continue
    if (!best || d.getTime() > best.getTime()) best = d
  }
  if (!best) return 'Not recorded'
  const raw = workspaces.find((w) => parseReviewDate(w.lastReview)?.getTime() === best.getTime())?.lastReview
  return raw ? formatRelativePolicySync(raw) : best.toLocaleDateString()
}

function approvalRequirementLabel(input: InviteMemberGovernancePostureInput): string {
  if (!input.workspaceRole) return 'Select role to preview'
  const worst = worstConfigurationStatus(input.selectedWorkspaces)
  const normalizedRole = input.workspaceRole.toLowerCase()
  const elevatedRole = normalizedRole.includes('admin') || normalizedRole.includes('owner') || normalizedRole.includes('manager') || normalizedRole.includes('editor')

  if (worst === 'Non-Compliant' && elevatedRole) return 'Approval recommended'
  if (worst === 'Unconfigured' && input.workspaceRole === 'Admin') return 'Approval recommended'
  if (worst === 'Partial' && normalizedRole.includes('admin')) return 'Review recommended'
  return 'Not required'
}

export function buildInviteMemberGovernancePosture(
  input: InviteMemberGovernancePostureInput
): GovernancePostureCardModel[] {
  const config = worstConfigurationStatus(input.selectedWorkspaces)
  const gov = workspaceGovernanceLabel(config, input.selectedWorkspaces)
  const risk = participationRiskLabel(input)
  const audit = auditVisibilityLabel(input.selectedWorkspaces)
  const scope = participationScopeDisplay(input.participationScopeOptions, input.participationScopeCode)

  return [
    { label: 'Workspace governance', value: gov.value, tone: gov.tone },
    { label: 'Participation risk', value: risk.value, tone: risk.tone },
    { label: 'Audit visibility', value: audit.value, tone: audit.tone },
    { label: 'Participation scope', value: scope, tone: 'info' },
  ]
}

export function buildInviteMemberActivityAudit(
  input: InviteMemberGovernancePostureInput
): InviteMemberActivityAuditModel {
  return {
    invitationSource: 'Manual invitation',
    requestedBy: input.requestedByName.trim() || 'Current user',
    approvalRequirement: approvalRequirementLabel(input),
    lastPolicySync: latestPolicyReview(input.selectedWorkspaces),
  }
}
