const USERNAME_LIKE_PATTERN = /^[a-z0-9._-]+$/i

/** True when the value looks like an email local-part or login username (no spaces). */
export function looksLikeUsernameOrEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.includes('@')) return true
  if (/\s/.test(trimmed)) return false
  return USERNAME_LIKE_PATTERN.test(trimmed)
}

/**
 * Standard UI display name: Title Case with spaces (e.g. `ricky.gunawan` → `Ricky Gunawan`).
 * Identity `display_name` values with spaces are title-cased consistently.
 */
export function normalizeUserDisplayName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return 'Unknown'
  if (trimmed.toLowerCase() === 'system') return 'System'

  if (/\s/.test(trimmed) && !trimmed.includes('@')) {
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  if (!looksLikeUsernameOrEmail(trimmed)) {
    return trimmed
  }

  const localPart = trimmed.includes('@') ? trimmed.split('@')[0] ?? trimmed : trimmed
  const parts = localPart.split(/[._-]+/).filter(Boolean)
  if (parts.length === 0) return trimmed

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
