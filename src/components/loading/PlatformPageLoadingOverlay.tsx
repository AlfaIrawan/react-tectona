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

/** Fullscreen in-layout (bukan service). Untuk data API gunakan `PlatformServiceLoadingPanel`. */
export function PlatformPageLoadingOverlay({
  title = 'Memuat halaman...',
  description = 'Menyiapkan tampilan modul.',
  className,
  fullScreen = false,
  fillViewport = false,
}: PlatformPageLoadingOverlayProps) {
  if (fullScreen) {
    return (
      <div
        className={cn('fixed inset-x-0 bottom-0 top-12 z-30 flex flex-col', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={title}
      >
        <PlatformLoadingBackdrop className="flex min-h-full w-full flex-1 items-center justify-center">
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
