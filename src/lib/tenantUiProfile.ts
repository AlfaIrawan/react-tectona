import type { ModuleId } from '@/auth/useModuleAccess'
import type { TenantMode } from '@/lib/onboardingFeature'

/**
 * Modules hidden for end-user GA menu until ready.
 * Visible set matches App Launcher for personal / non-organization users:
 * Workspace, Project, Idea & Backlog, Task & Work, Planning & Scheduling, Document & Knowledge.
 * Platform admin bypasses.
 */
export const CORPORATE_HIDDEN_MODULE_IDS: readonly ModuleId[] = [
  'ai_idea',
  'ai_project',
  'integration_api',
  'reporting',
  'enterprise_governance_model',
  'portfolio_governance',
  'resource',
  'workflow',
] as const

/** Canonical end-user App Launcher order (non–platform-admin GA menu). */
export const END_USER_GA_MODULE_IDS: readonly ModuleId[] = [
  'workspace',
  'project',
  'idea_backlog',
  'task_work',
  'planning',
  'document_knowledge',
] as const

export function isCorporateTenantMode(tenantMode: TenantMode | null | undefined): boolean {
  return tenantMode === 'organization'
}

export type CorporateUiPolicyInput = {
  tenantMode: TenantMode | null | undefined
  isPlatformAdmin: boolean
  isCorporateUser: boolean
  isAllWorkspaces: boolean
}

/**
 * End-user GA module menu (same as personal / non-organization launcher):
 * corporate email users, and every personal-tenant session.
 * Platform admin bypasses.
 */
export function shouldApplyCorporateUiRestrictions(opts: CorporateUiPolicyInput): boolean {
  if (opts.isPlatformAdmin) return false
  if (opts.tenantMode === 'personal') return true
  return opts.isCorporateUser
}

export function isModuleHiddenForCorporateTenant(
  moduleId: ModuleId,
  opts: CorporateUiPolicyInput,
): boolean {
  if (!shouldApplyCorporateUiRestrictions(opts)) return false
  return CORPORATE_HIDDEN_MODULE_IDS.includes(moduleId)
}

export function shouldHideKnowledgeBaseSection(_opts: CorporateUiPolicyInput): boolean {
  // DKM always exposes Library Overview + Knowledge Base integration for every signed-in user.
  return false
}

export type TenantUiProfile = {
  hideWorkspaceModule: boolean
  hideKnowledgeBaseSection: boolean
  hiddenModuleIds: readonly ModuleId[]
}

export function buildTenantUiProfile(opts: CorporateUiPolicyInput): TenantUiProfile {
  const applyEndUserGaMenu = shouldApplyCorporateUiRestrictions(opts)
  // Personal tenants always expose the Workspace module (self-workspace control).
  // Organization Workspace Management stays role-gated in useModuleAccess (Admin).
  const hideWorkspaceModule = false
  const hideKnowledgeBaseSection = false
  const hiddenModuleIds = applyEndUserGaMenu ? [...CORPORATE_HIDDEN_MODULE_IDS] : []

  return { hideWorkspaceModule, hideKnowledgeBaseSection, hiddenModuleIds }
}
