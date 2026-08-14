import { PlatformServiceLoadingPanel } from '@/components/loading/PlatformServiceLoadingPanel'
import { cn } from '@/lib/utils'

export type PlatformDataLoadingStateProps = {
  title?: string
  description?: string
  className?: string
  compact?: boolean
}

/**
 * In-page data/API loading state (shell & topbar stay visible).
 * Do not use for lazy route chunks — use `PlatformRouteLoadingFallback`.
 */
export function PlatformDataLoadingState({
  title = 'Loading data',
  description = 'Fetching the latest records from the service.',
  className,
  compact = false,
}: PlatformDataLoadingStateProps) {
  return (
    <div
      className={cn(
        'relative flex w-full items-center justify-center overflow-hidden px-6 py-16',
        'min-h-[min(420px,60vh)]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.12),transparent_65%)]"
        aria-hidden
      />
      <PlatformServiceLoadingPanel title={title} description={description} compact={compact} />
    </div>
  )
}
