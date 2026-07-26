import {
  CANONICAL_PARTICIPATION_SCOPE_CODES,
  normalizeParticipationScopeCode,
} from '@/lib/participationScopeRules'

export type ParticipationScopeOption = {
  id: string
  value: string
  label: string
  isSystem: boolean
}

/** Hide retired v1 codes and dedupe by canonical scope_code (API may still return legacy rows). */
export function filterCanonicalParticipationScopeOptions(
  options: ParticipationScopeOption[]
): ParticipationScopeOption[] {
  const canonicalOrder = new Map(
    CANONICAL_PARTICIPATION_SCOPE_CODES.map((code, index) => [code, index])
  )
  const byCode = new Map<string, ParticipationScopeOption>()
  for (const option of options) {
    const code = normalizeParticipationScopeCode(option.value)
    if (!canonicalOrder.has(code)) continue
    const existing = byCode.get(code)
    if (!existing || option.isSystem) {
      byCode.set(code, { ...option, value: code })
    }
  }
  return CANONICAL_PARTICIPATION_SCOPE_CODES.map((code) => byCode.get(code)).filter(
    (o): o is ParticipationScopeOption => o != null
  )
}

export const DEFAULT_PARTICIPATION_SCOPE_CODE = 'project_only'

export function mapWacParticipationScopeDto(dto: {
  id: string
  scope_code: string
  display_name: string
  is_system?: boolean
}): ParticipationScopeOption {
  return {
    id: dto.id,
    value: dto.scope_code,
    label: dto.display_name,
    isSystem: dto.is_system ?? true,
  }
}

export type WorkspaceMemberUiRole = 'Admin' | 'Manager' | 'Member' | 'Viewer'

export function defaultParticipationScopeCodeForUiRole(role: WorkspaceMemberUiRole): string {
  switch (role) {
    case 'Admin':
      return 'all'
    case 'Manager':
      return 'program_only'
    case 'Viewer':
      return 'read_only_workspace'
    default:
      return DEFAULT_PARTICIPATION_SCOPE_CODE
  }
}

export function participationScopeLabelForCode(
  options: ParticipationScopeOption[],
  code: string
): string | undefined {
  return options.find((o) => o.value === code)?.label
}
