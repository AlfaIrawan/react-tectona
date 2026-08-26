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
  personalWorkspaceAdmin: 'tectona.personal_workspace_admin',
  workspaceAdmin: 'tectona.workspace_admin',
  governanceLead: 'tectona.governance_lead',
  projectManager: 'tectona.project_manager',
  portfolioManager: 'tectona.portfolio_manager',
  securityReviewer: 'tectona.security_reviewer',
  integrationOperator: 'tectona.integration_operator',
  platformMember: 'tectona.platform_member',
  externalReviewer: 'tectona.external_reviewer',
  solutionArchitect: 'tectona.solution_architect',
  technologyArchitect: 'tectona.technology_architect',
  dataArchitect: 'tectona.data_architect',
  applicationArchitect: 'tectona.application_architect',
  technicalLead: 'tectona.technical_lead',
  developer: 'tectona.developer',
  qa: 'tectona.qa',
  systemAnalyst: 'tectona.system_analyst',
  businessAnalyst: 'tectona.business_analyst',
} as const

export type TectonaAuthzResource = (typeof TECTONA_AUTHZ_RESOURCES)[keyof typeof TECTONA_AUTHZ_RESOURCES]

export const TECTONA_AUTHZ_ACTIONS = {
  view: 'view',
  manage: 'manage',
} as const
