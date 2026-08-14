import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { checkSlugAvailability } from '@/lib/api/workspaceOrgApi'
import { isValidSlugFormat } from '@/lib/onboardingFeature'

export function useSlugAvailability(slug: string, debounceMs = 300) {
  const [debounced, setDebounced] = useState(slug)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(slug), debounceMs)
    return () => window.clearTimeout(timer)
  }, [slug, debounceMs])

  const normalized = debounced.trim().toLowerCase()
  const formatValid = normalized.length > 0 && isValidSlugFormat(normalized)

  const query = useQuery({
    queryKey: ['slug-availability', normalized],
    queryFn: () => checkSlugAvailability(normalized),
    enabled: formatValid,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })

  return {
    slug: normalized,
    formatValid,
    loading: formatValid && query.isFetching,
    available: formatValid ? query.data?.available === true : false,
    reason: query.data?.reason ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}
