import { useQueries } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { checkSlugAvailability } from '@/lib/api/workspaceOrgApi'
import {
  buildPersonalWorkspaceSuggestionBatches,
  MAX_SUGGESTION_BATCHES,
  SUGGESTIONS_PER_PAGE,
  type PersonalWorkspaceSuggestion,
} from '@/lib/personalWorkspaceSuggestions'

export type PersonalWorkspaceSuggestionOption = PersonalWorkspaceSuggestion & {
  available: boolean | null
}

export function usePersonalWorkspaceSuggestions(email: string) {
  const [visiblePage, setVisiblePage] = useState(0)

  // Fixed-size pool so useQueries always registers the same number of hooks.
  const candidates = useMemo(
    () => buildPersonalWorkspaceSuggestionBatches(email, MAX_SUGGESTION_BATCHES),
    [email],
  )

  const queries = useQueries({
    queries: candidates.map((candidate) => ({
      queryKey: ['slug-availability', candidate.slug, 'suggestion-pool'],
      queryFn: () => checkSlugAvailability(candidate.slug),
      staleTime: 30_000,
      retry: false,
      enabled: Boolean(email.trim()),
    })),
  })

  const loading = queries.some((q) => q.isFetching)

  const checked: PersonalWorkspaceSuggestionOption[] = candidates.map((candidate, index) => {
    const query = queries[index]
    if (query?.isFetching) {
      return { ...candidate, available: null }
    }
    if (query?.isError) {
      return { ...candidate, available: false }
    }
    return {
      ...candidate,
      available: query?.data?.available === true,
    }
  })

  const availableOnly = checked.filter((item) => item.available === true)
  const recommended = useMemo(() => {
    const first = availableOnly[0]
    if (!first) return null
    return { displayName: first.displayName, slug: first.slug }
  }, [availableOnly[0]?.displayName, availableOnly[0]?.slug])
  const hasCheckErrors = queries.some((q) => q.isError)

  const totalPages = Math.max(1, Math.ceil(availableOnly.length / SUGGESTIONS_PER_PAGE))
  const safePage = availableOnly.length === 0 ? 0 : visiblePage % totalPages
  const visibleSuggestions = availableOnly.slice(
    safePage * SUGGESTIONS_PER_PAGE,
    safePage * SUGGESTIONS_PER_PAGE + SUGGESTIONS_PER_PAGE,
  )

  const canRefresh = availableOnly.length > SUGGESTIONS_PER_PAGE

  const refresh = useCallback(() => {
    if (availableOnly.length <= SUGGESTIONS_PER_PAGE) {
      setVisiblePage(0)
      return
    }
    setVisiblePage((page) => (page + 1) % totalPages)
  }, [availableOnly.length, totalPages])

  return {
    visibleSuggestions,
    availableOnly,
    recommended,
    loading,
    refresh,
    canRefresh,
    hasCheckErrors,
    defaultCandidate: candidates[0] ?? null,
  }
}
