import { PlatformLoadingBackdrop, PlatformLoadingCard } from '@/components/loading/PlatformLoadingBackdrop'

export type PlatformRouteLoadingFallbackProps = {
  title?: string
  description?: string
}

/**
 * Loader SATU HALAMAN penuh (lazy route / Suspense chunk).
 * Bukan untuk fetch data API — pakai `PlatformDataLoadingState`.
 */
export function PlatformRouteLoadingFallback({
  title = 'Loading page...',
  description = 'Preparing Tectona module.',
}: PlatformRouteLoadingFallbackProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" role="status" aria-live="polite" aria-busy="true" aria-label={title}>
      <PlatformLoadingBackdrop className="flex min-h-dvh w-full flex-1 items-center justify-center">
        <PlatformLoadingCard title={title} description={description} />
      </PlatformLoadingBackdrop>
    </div>
  )
}
