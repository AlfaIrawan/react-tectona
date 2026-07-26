/**
 * Participation scope (WAC collaboration boundary) ↔ Delivery context fields.
 * Codes: all | project_only | program_only | portfolio_only | read_only_workspace
 */

export const PARTICIPATION_SCOPE_CODE = {
  ALL: 'all',
  PROJECT_ONLY: 'project_only',
  PROGRAM_ONLY: 'program_only',
  PORTFOLIO_ONLY: 'portfolio_only',
  READ_ONLY_WORKSPACE: 'read_only_workspace',
} as const

/** Stable codes shown in invite/manage dropdowns (v2 catalog). */
export const CANONICAL_PARTICIPATION_SCOPE_CODES: readonly string[] = [
  PARTICIPATION_SCOPE_CODE.ALL,
  PARTICIPATION_SCOPE_CODE.PROJECT_ONLY,
  PARTICIPATION_SCOPE_CODE.PROGRAM_ONLY,
  PARTICIPATION_SCOPE_CODE.PORTFOLIO_ONLY,
  PARTICIPATION_SCOPE_CODE.READ_ONLY_WORKSPACE,
]

const CANONICAL_SET = new Set<string>(CANONICAL_PARTICIPATION_SCOPE_CODES)

/** Legacy codes from catalog v1 — map for in-flight forms / cached API rows. */
const LEGACY_SCOPE_CODE: Record<string, string> = {
  all_projects: PARTICIPATION_SCOPE_CODE.ALL,
  assigned_projects_only: PARTICIPATION_SCOPE_CODE.PROJECT_ONLY,
}

export function normalizeParticipationScopeCode(code: string): string {
  const trimmed = code.trim()
  return LEGACY_SCOPE_CODE[trimmed] ?? trimmed
}

export function participationScopeAllowsLinkedPrograms(code: string): boolean {
  const c = normalizeParticipationScopeCode(code)
  return (
    c === PARTICIPATION_SCOPE_CODE.ALL
    || c === PARTICIPATION_SCOPE_CODE.PROGRAM_ONLY
    || c === PARTICIPATION_SCOPE_CODE.PORTFOLIO_ONLY
  )
}

export function participationScopeAllowsLinkedProjects(code: string): boolean {
  const c = normalizeParticipationScopeCode(code)
  return c === PARTICIPATION_SCOPE_CODE.ALL || c === PARTICIPATION_SCOPE_CODE.PROJECT_ONLY
}

export type DeliveryContextValidation = { ok: true } | { ok: false; message: string }

/** Client-side guard before WAC POST; mirrors backend participation_scope_validation.py */
export function validateMembershipDeliveryContext(
  participationScopeCode: string,
  linkedProjects: string[],
  linkedPrograms: string[]
): DeliveryContextValidation {
  const code = normalizeParticipationScopeCode(participationScopeCode)
  const hasProjects = linkedProjects.length > 0
  const hasPrograms = linkedPrograms.length > 0

  if (code === PARTICIPATION_SCOPE_CODE.READ_ONLY_WORKSPACE) {
    if (hasProjects || hasPrograms) {
      return {
        ok: false,
        message: 'Read-only workspace cannot include linked programs or projects.',
      }
    }
    return { ok: true }
  }
  if (code === PARTICIPATION_SCOPE_CODE.PROJECT_ONLY) {
    if (hasPrograms) {
      return {
        ok: false,
        message: 'Project only cannot include linked programs. Use Program only or Portfolio only.',
      }
    }
    return { ok: true }
  }
  if (code === PARTICIPATION_SCOPE_CODE.PROGRAM_ONLY) {
    if (hasProjects) {
      return {
        ok: false,
        message: 'Program only cannot include linked projects. Use Project only or All.',
      }
    }
    return { ok: true }
  }
  if (code === PARTICIPATION_SCOPE_CODE.PORTFOLIO_ONLY) {
    if (hasProjects) {
      return {
        ok: false,
        message: 'Portfolio only cannot include linked projects. Link programs instead.',
      }
    }
    return { ok: true }
  }
  if (code === PARTICIPATION_SCOPE_CODE.ALL) {
    return { ok: true }
  }
  return { ok: false, message: `Unknown participation scope: ${participationScopeCode}` }
}

export function participationScopeHint(code: string): string {
  const c = normalizeParticipationScopeCode(code)
  switch (c) {
    case PARTICIPATION_SCOPE_CODE.ALL:
      return 'All — collaboration across project, program, and portfolio in assigned workspaces. Linked programs and projects are optional refinements.'
    case PARTICIPATION_SCOPE_CODE.PROJECT_ONLY:
      return 'Project only — link specific projects below. Programs are not in scope.'
    case PARTICIPATION_SCOPE_CODE.PROGRAM_ONLY:
      return 'Program only — link programs below. Projects are not in scope.'
    case PARTICIPATION_SCOPE_CODE.PORTFOLIO_ONLY:
      return 'Portfolio only — link portfolio/program groupings below. Individual project links are not in scope.'
    case PARTICIPATION_SCOPE_CODE.READ_ONLY_WORKSPACE:
      return 'Read-only workspace — workspace-level visibility without delivery links.'
    default:
      return 'Collaboration boundary in this workspace; independent of Security & Access Control matrices.'
  }
}
