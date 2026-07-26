/**
 * App entry gate: require workspace membership (or platform admin) before full Tectona shell.
 *
 * Default: enabled (production-like dev). Set VITE_TECTONA_REQUIRE_WORKSPACE_MEMBERSHIP=false to disable.
 */

function envFlag(name: string): string | undefined {
  return (import.meta.env[name] as string | undefined)?.trim()
}

export function isWorkspaceMembershipGateEnabled(): boolean {
  const override = envFlag('VITE_TECTONA_REQUIRE_WORKSPACE_MEMBERSHIP')
  if (override === 'false') return false
  if (override === 'true') return true
  return true
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isValidInviteEmail(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed.includes('@')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}
