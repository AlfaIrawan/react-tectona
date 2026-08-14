import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { badgeToneToLayerStatus } from '@/lib/platformHealth/diagnosePlatformHealth'
import {
  LayerSignalBars,
  layerStatusLabel,
  layerStatusLabelClass,
} from '@/lib/platformHealth/LayerSignalBars'
import { usePlatformHealth } from '@/lib/platformHealth/usePlatformHealth'

export function PlatformHealthBadge() {
  const { diagnosis, health, loading, refresh, workOffline } = usePlatformHealth()

  const workDetail =
    workOffline.pendingCount > 0
      ? `${workOffline.pendingCount} change(s) pending sync`
      : workOffline.conflictCount > 0
        ? `${workOffline.conflictCount} sync conflict(s)`
        : null

  const badgeLayerStatus = badgeToneToLayerStatus(diagnosis.badgeTone)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="environment-indicator flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-sm hover:border-slate-300/90"
          aria-live="polite"
          aria-label={`Platform status: ${diagnosis.badgeLabel}`}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-500" aria-hidden />
          ) : (
            <LayerSignalBars status={badgeLayerStatus} size="sm" />
          )}
          <span className="text-xs font-medium text-slate-800">{diagnosis.badgeLabel}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Platform status</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{diagnosis.headline}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Layer summary
            </p>
            <ul className="space-y-2.5">
              {diagnosis.layers.map((layer) => (
                <li key={layer.key} className="flex items-start gap-2.5 text-xs">
                  <LayerSignalBars status={layer.status} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {layer.label}{' '}
                      <span className={layerStatusLabelClass(layer.status)}>
                        · {layerStatusLabel(layer.status, layer.key)}
                      </span>
                    </p>
                    <p className="mt-0.5 leading-relaxed text-muted-foreground">{layer.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {diagnosis.recentHighlight ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              <p className="font-medium">Recent activity</p>
              <p className="mt-0.5 leading-relaxed">{diagnosis.recentHighlight}</p>
            </div>
          ) : null}

          {workDetail ? (
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-xs text-sky-950">
              Work sync: {workDetail}
            </div>
          ) : null}

          <div className="rounded-xl border border-border/50 bg-background px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Suggestion</p>
            <p className="mt-0.5 leading-relaxed">{diagnosis.suggestion}</p>
          </div>

          {health?.checked_at ? (
            <p className="text-[10px] text-muted-foreground">
              Last checked: {new Date(health.checked_at).toLocaleString('en-US')}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Check again
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
