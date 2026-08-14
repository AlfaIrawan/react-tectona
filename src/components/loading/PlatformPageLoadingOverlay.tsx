import { PlatformLoadingBackdrop, PlatformLoadingCard } from '@/components/loading/PlatformLoadingBackdrop'
import { cn } from '@/lib/utils'

export type PlatformPageLoadingOverlayProps = {
  title?: string
  description?: string
  className?: string
  /** Satu layar penuh — hanya untuk inisialisasi shell halaman (jarang); bukan fetch service. */
  fullScreen?: boolean
  /** Isi sisa tinggi parent flex (mis. di bawah breadcrumb). */
  fillViewport?: boolean
}

/**
 * Overlay inisialisasi tampilan modul.
 * - `fullScreen`: menutup viewport (setara route load).
 * - Tanpa fullScreen: area konten saja.
 * Untuk fetch API / list data → `PlatformDataLoadingState` / `PlatformServiceLoadingPanel`.
 */
export function PlatformPageLoadingOverlay({
  title = 'Loading page...',
  description = 'Preparing Tectona module.',
  className,
  fullScreen = false,
  fillViewport = false,
}: PlatformPageLoadingOverlayProps) {
  if (fullScreen) {
    return (
      <div
        className={cn('fixed inset-0 z-[100] flex flex-col', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={title}
      >
        <PlatformLoadingBackdrop className="flex min-h-dvh w-full flex-1 items-center justify-center">
          <PlatformLoadingCard title={title} description={description} />
        </PlatformLoadingBackdrop>
      </div>
    )
  }

  return (
    <div
      className={cn('relative w-full', fillViewport && 'flex min-h-0 flex-1 flex-col', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <PlatformLoadingBackdrop
        className={cn(
          'flex w-full items-center justify-center',
          fillViewport ? 'min-h-0 flex-1 rounded-2xl' : 'min-h-[min(420px,68vh)] rounded-2xl'
        )}
      >
        <PlatformLoadingCard title={title} description={description} />
      </PlatformLoadingBackdrop>
    </div>
  )
}
