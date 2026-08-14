import { isValidSlugFormat, suggestSlugFromName } from '@/lib/onboardingFeature'

export type PersonalWorkspaceSuggestion = {
  displayName: string
  slug: string
}

export const SUGGESTIONS_PER_PAGE = 3
export const MAX_SUGGESTION_BATCHES = 4

function titleCase(part: string): string {
  if (!part) return ''
  return part.charAt(0).toUpperCase() + part.slice(1)
}

function dedupeBySlug(items: PersonalWorkspaceSuggestion[]): PersonalWorkspaceSuggestion[] {
  const seen = new Set<string>()
  const unique: PersonalWorkspaceSuggestion[] = []
  for (const item of items) {
    const slug = item.slug.trim().toLowerCase()
    if (!slug || !isValidSlugFormat(slug) || seen.has(slug)) continue
    seen.add(slug)
    unique.push({ ...item, slug })
  }
  return unique
}

function parseEmailLocal(email: string): { fullName: string; joined: string; first: string; last: string } | null {
  const local = email.trim().toLowerCase().split('@')[0] ?? ''
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length === 0) return null
  const fullName = parts.map(titleCase).join(' ')
  const joined = parts.join('-')
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return { fullName, joined, first, last }
}

/** Primary suggestions — unique display names from email local-part. */
export function buildPersonalWorkspaceSuggestions(email: string): PersonalWorkspaceSuggestion[] {
  const parsed = parseEmailLocal(email)
  if (!parsed) return []

  const { fullName, joined, first, last } = parsed
  const raw: PersonalWorkspaceSuggestion[] = []

  if (fullName) {
    raw.push({ displayName: `${fullName} WS`, slug: suggestSlugFromName(`${fullName} WS`) })
    raw.push({ displayName: fullName, slug: suggestSlugFromName(fullName) })
    raw.push({ displayName: `${fullName} Personal`, slug: `${joined}-personal` })
  }

  if (first && last && first !== last) {
    raw.push({ displayName: `${titleCase(first)} ${titleCase(last)}`, slug: `${first}-${last}` })
  }

  return dedupeBySlug(raw)
}

/** Extra batches for refresh — each entry has a distinct display name. */
export function buildPersonalWorkspaceSuggestionBatch(
  email: string,
  batchIndex: number,
): PersonalWorkspaceSuggestion[] {
  const parsed = parseEmailLocal(email)
  if (!parsed || batchIndex < 1) return []

  const { fullName, joined, first, last } = parsed
  const raw: PersonalWorkspaceSuggestion[] = []

  if (batchIndex === 1) {
    raw.push(
      { displayName: `${fullName} Workspace`, slug: `${joined}-workspace` },
      { displayName: `${fullName} Home`, slug: `${joined}-home` },
      { displayName: `${fullName} Private`, slug: `${joined}-private` },
    )
    if (first && last) {
      raw.push({ displayName: `${titleCase(first)} ${titleCase(last)} Workspace`, slug: `${first}-${last}-workspace` })
    }
  } else if (batchIndex === 2) {
    for (let n = 2; n <= 6; n += 1) {
      raw.push({
        displayName: `${fullName} WS ${n}`,
        slug: `${joined}-ws-${n}`,
      })
    }
  } else if (batchIndex === 3) {
    if (first) {
      raw.push({ displayName: `${titleCase(first)} Workspace`, slug: `${first}-workspace` })
    }
    if (last && last !== first) {
      raw.push({ displayName: `${titleCase(last)} Workspace`, slug: `${last}-workspace` })
    }
    raw.push({ displayName: `${fullName} Projects`, slug: `${joined}-projects` })
  }

  return dedupeBySlug(raw)
}

export function buildPersonalWorkspaceSuggestionBatches(email: string, batchCount: number): PersonalWorkspaceSuggestion[] {
  const capped = Math.min(Math.max(batchCount, 1), MAX_SUGGESTION_BATCHES)
  const merged: PersonalWorkspaceSuggestion[] = [...buildPersonalWorkspaceSuggestions(email)]
  for (let i = 1; i < capped; i += 1) {
    merged.push(...buildPersonalWorkspaceSuggestionBatch(email, i))
  }
  return dedupeBySlug(merged)
}
