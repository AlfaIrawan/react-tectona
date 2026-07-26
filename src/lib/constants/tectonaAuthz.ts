/** Tectona app namespace in authorization-policy (identity-lite OIDC app_id). */
export const TECTONA_AUTHZ_APP_ID = '00000000-0000-0000-0000-000000000014'

export const TECTONA_AUTHZ_RESOURCES = {
  workspace: 'workspace',
  organization: 'organization',
  governance: 'governance',
  portfolio: 'portfolio',
  securityMatrix: 'security_matrix',
} as const

/** Default AuthZ role codes (authorization-policy bootstrap). */
export const TECTONA_AUTHZ_ROLE_CODES = {
  platformAdmin: 'tectona.admin',
  workspaceAdmin: 'tectona.workspace_admin',
  governanceLead: 'tectona.governance_lead',
  projectManager: 'tectona.project_manager',
  portfolioManager: 'tectona.portfolio_manager',
  securityReviewer: 'tectona.security_reviewer',
  integrationOperator: 'tectona.integration_operator',
  platformMember: 'tectona.platform_member',
  externalReviewer: 'tectona.external_reviewer',
  businessPartnerHead: 'tectona.business_partner_head',
  brmHead: 'tectona.brm_head',
  businessAnalyst: 'tectona.business_analyst',
} as const

export type TectonaAuthzResource = (typeof TECTONA_AUTHZ_RESOURCES)[keyof typeof TECTONA_AUTHZ_RESOURCES]

export const TECTONA_AUTHZ_ACTIONS = {
  view: 'view',
  manage: 'manage',
} as const
