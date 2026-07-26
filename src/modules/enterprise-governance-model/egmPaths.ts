export const EGM_BASE = '/enterprise-governance-model' as const

export const egmPath = (suffix: string) =>
  `${EGM_BASE}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
