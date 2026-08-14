import { CheckCircle2, ExternalLink, XCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PlatformHealthServiceStatus } from '@/lib/api/traceabilityMonitoringApi'

const STATUS_META: Record<PlatformHealthServiceStatus['status'], { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  up: { label: 'Up', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300', Icon: CheckCircle2 },
  degraded: { label: 'Degraded', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300', Icon: AlertTriangle },
  down: { label: 'Down', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300', Icon: XCircle },
}

interface PlatformHealthCardsProps {
  services: PlatformHealthServiceStatus[]
  loading?: boolean
  salixBaseUrl?: string
}

function formatServiceLabel(service: string): string {
  return service
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function PlatformHealthCards({ services, loading, salixBaseUrl }: PlatformHealthCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading && services.length === 0
          ? Array.from({ length: 6 }, (_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <CardTitle className="h-4 w-24 rounded bg-muted" />
                </CardHeader>
                <CardContent>
                  <div className="h-6 w-16 rounded bg-muted" />
                </CardContent>
              </Card>
            ))
          : services.map((service) => {
              const meta = STATUS_META[service.status]
              const Icon = meta.Icon
              return (
                <Card key={service.service} className={cn('border', meta.className)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-semibold">{formatServiceLabel(service.service)}</CardTitle>
                    <Icon className="h-4 w-4" />
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <Badge variant="outline" className={cn('border-current', meta.className)}>
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{service.latency_ms} ms</span>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
        <p>
          This is a read-only status summary for services relevant to Tectona — not a log explorer or metrics
          dashboard. For request-level logs, traces, and historical incidents, use Salix (Central Log Management)
          and Acerra (AI Observability Management).
        </p>
        {salixBaseUrl ? (
          <a
            href={salixBaseUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 gap-1.5 no-underline')}
          >
            Open in Salix
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  )
}
