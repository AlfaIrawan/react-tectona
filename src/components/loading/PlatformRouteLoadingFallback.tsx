import { PlatformLoadingBackdrop, PlatformLoadingCard } from '@/components/loading/PlatformLoadingBackdrop'

export type PlatformRouteLoadingFallbackProps = {
  title?: string
  description?: string
}

/** Full-screen: lazy route / chunk halaman (bukan fetch API). */
export function PlatformRouteLoadingFallback({
  title = 'Memuat halaman...',
  description = 'Menyiapkan modul Tectona.',
}: PlatformRouteLoadingFallbackProps) {
  return (
    <PlatformLoadingBackdrop className="min-h-screen">
      <PlatformLoadingCard title={title} description={description} />
    </PlatformLoadingBackdrop>
  )
}
