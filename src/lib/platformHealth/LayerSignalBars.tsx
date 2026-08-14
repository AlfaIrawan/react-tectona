import { cn } from '@/lib/utils'
import type { LayerStatus } from './types'

export type SignalTone = 'green' | 'amber' | 'red' | 'slate'

const BAR_HEIGHTS = ['h-[35%]', 'h-[50%]', 'h-[70%]', 'h-full'] as const

export function layerStatusToSignalLevel(status: LayerStatus): 0 | 1 | 2 | 3 | 4 {
  switch (status) {
    case 'ok':
      return 4
    case 'degraded':
      return 2
    case 'unavailable':
      return 1
    default:
      return 0
  }
}

export function layerStatusToSignalTone(status: LayerStatus): SignalTone {
  switch (status) {
    case 'ok':
      return 'green'
    case 'degraded':
      return 'amber'
    case 'unavailable':
      return 'red'
    default:
      return 'slate'
  }
}

export function signalToneClass(tone: SignalTone, active: boolean): string {
  if (!active) return 'bg-slate-200/90'
  switch (tone) {
    case 'green':
      return 'bg-green-500'
    case 'amber':
      return 'bg-amber-500'
    case 'red':
      return 'bg-rose-500'
    default:
      return 'bg-slate-300'
  }
}

export function layerStatusLabel(
  status: LayerStatus,
  layerKey?: 'network' | 'application' | 'services' | 'database',
): string {
  if (layerKey === 'network') {
    switch (status) {
      case 'ok':
        return 'Normal'
      case 'degraded':
        return 'Slow'
      case 'unavailable':
        return 'Offline'
      default:
        return 'Unknown'
    }
  }
  switch (status) {
    case 'ok':
      return 'Normal'
    case 'degraded':
      return 'Limited'
    case 'unavailable':
      return 'Down'
    default:
      return 'Unknown'
  }
}

export function layerStatusLabelClass(status: LayerStatus): string {
  switch (status) {
    case 'ok':
      return 'text-green-600'
    case 'degraded':
      return 'text-amber-600'
    case 'unavailable':
      return 'text-rose-600'
    default:
      return 'text-slate-500'
  }
}

interface LayerSignalBarsProps {
  status: LayerStatus
  className?: string
  /** Smaller variant for the topbar badge */
  size?: 'sm' | 'md'
}

export function LayerSignalBars({ status, className, size = 'md' }: LayerSignalBarsProps) {
  const level = layerStatusToSignalLevel(status)
  const tone = layerStatusToSignalTone(status)
  const barWidth = size === 'sm' ? 'w-[2px]' : 'w-[3px]'
  const gap = size === 'sm' ? 'gap-[1.5px]' : 'gap-[2px]'
  const height = size === 'sm' ? 'h-2.5 w-3' : 'h-3.5 w-4'

  return (
    <div
      className={cn('flex shrink-0 items-end', gap, height, className)}
      aria-hidden
    >
      {BAR_HEIGHTS.map((barHeight, index) => {
        const barIndex = index + 1
        const active = barIndex <= level
        return (
          <span
            key={barIndex}
            className={cn('rounded-[1px]', barWidth, barHeight, signalToneClass(tone, active))}
          />
        )
      })}
    </div>
  )
}
