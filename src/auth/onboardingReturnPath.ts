// Navigation hints never grant access; the destination retains its normal gates.
export function onboardingReturnPath(state: unknown, tenantSlug?: string | null): string {
  const path = state && typeof state === 'object' && 'returnTo' in state ? state.returnTo : null
  if (typeof path === 'string' && /^\/(?!\/)/.test(path) &&
      !path.includes('\\') && ![...path].some(char => char.charCodeAt(0) <= 32) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(path) &&
      !/^\/(?:onboarding|login|logout|auth)(?:[/?#]|$)/i.test(path)) return path
  return tenantSlug && /^[a-zA-Z0-9_-]+$/.test(tenantSlug)
    ? `/w/${tenantSlug}/idea-backlog` : '/idea-backlog'
}
