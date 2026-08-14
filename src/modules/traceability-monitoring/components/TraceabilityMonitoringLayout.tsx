import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, GitBranch, HeartPulse } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { useWorkspacePath } from '@/hooks/useWorkspaceNavigate'
import {
  TRACEABILITY_ACTIVITY_PATH,
  TRACEABILITY_LINEAGE_PATH,
  TRACEABILITY_PLATFORM_HEALTH_PATH,
} from '@/modules/traceability-monitoring/paths'

const TABS = [
  { to: TRACEABILITY_ACTIVITY_PATH, label: 'User Activity & Audit', icon: Activity },
  { to: TRACEABILITY_LINEAGE_PATH, label: 'Entity Lineage', icon: GitBranch },
  { to: TRACEABILITY_PLATFORM_HEALTH_PATH, label: 'Platform Health', icon: HeartPulse },
] as const

const PAGE_META: Record<string, { title: string; description: string }> = {
  [TRACEABILITY_ACTIVITY_PATH]: {
    title: 'User Activity & Audit',
    description: 'Cross-entity Tectona business activity — filter by actor, action, entity, and workspace.',
  },
  [TRACEABILITY_LINEAGE_PATH]: {
    title: 'Entity Lineage',
    description: 'Idea → Project → Work Item → Document → Approval/Decision relationship graph.',
  },
  [TRACEABILITY_PLATFORM_HEALTH_PATH]: {
    title: 'Platform Health',
    description: 'Read-only status summary for Tectona-relevant services — deep-link to Salix for log detail.',
  },
}

/** Entity Lineage needs a full-bleed canvas — the layout must not add scroll padding beneath the sub-nav. */
function isFullBleedPath(pathname: string): boolean {
  return pathname.startsWith(TRACEABILITY_LINEAGE_PATH)
}

export function TraceabilityMonitoringLayout() {
  const location = useLocation()
  const meta = PAGE_META[location.pathname] ?? PAGE_META[TRACEABILITY_ACTIVITY_PATH]
  const fullBleed = isFullBleedPath(location.pathname)

  const activityHref = useWorkspacePath(TRACEABILITY_ACTIVITY_PATH)
  const lineageHref = useWorkspacePath(TRACEABILITY_LINEAGE_PATH)
  const platformHealthHref = useWorkspacePath(TRACEABILITY_PLATFORM_HEALTH_PATH)
  const hrefByTo: Record<string, string> = {
    [TRACEABILITY_ACTIVITY_PATH]: activityHref,
    [TRACEABILITY_LINEAGE_PATH]: lineageHref,
    [TRACEABILITY_PLATFORM_HEALTH_PATH]: platformHealthHref,
  }

  return (
    <div className={cn('flex flex-col gap-4', fullBleed ? 'h-[calc(100dvh-8rem)] min-h-[560px]' : undefined)}>
      <div className="space-y-3">
        <Breadcrumb items={[{ label: 'Traceability & Monitoring' }]} />
        <PageHeader title={meta.title} description={meta.description} />
        <nav className="flex flex-wrap gap-2" aria-label="Traceability & Monitoring sections">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = location.pathname.startsWith(tab.to)
            return (
              <NavLink
                key={tab.to}
                to={hrefByTo[tab.to]}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border-slate-300 bg-slate-900 text-white shadow-sm dark:border-slate-600 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className={cn(fullBleed ? 'min-h-0 flex-1' : undefined)}>
        <Outlet />
      </div>
    </div>
  )
}
