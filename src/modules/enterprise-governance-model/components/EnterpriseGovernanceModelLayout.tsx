import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  BookMarked,
  FileStack,
  GitBranch,
  History,
  LayoutDashboard,
  Layers,
  Scale,
  ScrollText,
  Shield,
  Tag,
  Timer,
  Waypoints,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { EGM_BASE } from '@/modules/enterprise-governance-model/egmPaths'
import { getEgmPageMeta } from '@/modules/enterprise-governance-model/egmRouteMeta'
import { usePreferencesStore } from '@/stores/preferences-store'
import {
  isWorkspaceNavDocked,
  workspaceAsideClass,
  workspaceDockedContentInsetClass,
  workspaceMainColumnClass,
  workspaceNavInnerClass,
  workspaceNavMenuScrollClass,
  workspaceOuterGridClass,
} from '@/lib/workspaceNavLayout'

type NavPanel = {
  to: string
  label: string
  description: string
  badge: string
  icon: typeof Shield
}

const PANEL_GROUPS: { group: string; items: NavPanel[] }[] = [
  {
    group: 'Governance design',
    items: [
      { to: `${EGM_BASE}/overview`, label: 'Governance Overview', description: 'Executive posture & coverage signals', badge: 'Overview', icon: LayoutDashboard },
      { to: `${EGM_BASE}/templates`, label: 'Governance Templates', description: 'Reusable operating model bundles', badge: 'Design', icon: Layers },
      { to: `${EGM_BASE}/operating-model-builder`, label: 'Operating Model Builder', description: 'Guided composition wizard', badge: 'Build', icon: Waypoints },
    ],
  },
  {
    group: 'Policy registry',
    items: [
      { to: `${EGM_BASE}/policies/workflow`, label: 'Workflow Policies', description: 'Lifecycle & checkpoint standards', badge: 'Policy', icon: GitBranch },
      { to: `${EGM_BASE}/policies/sla`, label: 'SLA Policies', description: 'Response & delivery SLAs', badge: 'Policy', icon: Timer },
      { to: `${EGM_BASE}/policies/naming`, label: 'Naming Standards', description: 'Identifiers & coding patterns', badge: 'Policy', icon: Tag },
      { to: `${EGM_BASE}/policies/approval`, label: 'Approval Models', description: 'Decision & escalation matrices', badge: 'Policy', icon: FileStack },
    ],
  },
  {
    group: 'Compliance engine',
    items: [
      { to: `${EGM_BASE}/compliance/rules`, label: 'Compliance Rules', description: 'Scoring dimensions & weights', badge: 'Engine', icon: Shield },
      { to: `${EGM_BASE}/compliance/scoring`, label: 'Scoring Model', description: 'Weighting & roll-up logic', badge: 'Engine', icon: Scale },
      { to: `${EGM_BASE}/compliance/coverage`, label: 'Policy Coverage', description: 'Cross-template coverage map', badge: 'Engine', icon: BookMarked },
    ],
  },
  {
    group: 'Traceability',
    items: [
      { to: `${EGM_BASE}/traceability/usage`, label: 'Usage & Adoption', description: 'Where assets are consumed', badge: 'Trace', icon: Activity },
      { to: `${EGM_BASE}/traceability/history`, label: 'Change History', description: 'Registry semantic history', badge: 'Trace', icon: History },
      { to: `${EGM_BASE}/traceability/audit`, label: 'Audit Trail', description: 'Immutable audit evidence', badge: 'Trace', icon: ScrollText },
    ],
  },
]

function isNavActive(pathname: string, to: string): boolean {
  if (to.endsWith('/overview')) {
    return pathname === to || pathname === EGM_BASE || pathname === `${EGM_BASE}/`
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function EnterpriseGovernanceModelLayout() {
  const location = useLocation()
  const pathname = location.pathname

  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'

  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const meta = getEgmPageMeta(pathname)

  return (
    <div className="min-h-0 space-y-6 pb-0">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, false, enterpriseNavWidthVariant))}>
        <Breadcrumb items={meta.breadcrumbs} />

        <PageHeader title={meta.title} description={meta.description} right={meta.right} />

        <section
          className={cn(
            workspaceOuterGridClass(sidebarFixed, false, enterpriseNavWidthVariant),
            sidebarFixed && 'items-stretch',
            navDocked ? 'relative' : undefined
          )}
        >
          <aside className={workspaceAsideClass(navDocked, false, enterpriseNavWidthVariant)} aria-label="Enterprise governance navigation">
            <div className={cn(workspaceNavInnerClass(navDocked, sidebarFixed, false), !navDocked && 'overflow-hidden')}>
              <div className="mb-3 flex items-center justify-between">
                <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Enterprise Navigation</span>
              </div>

              {!enterpriseNavSimpleList ? (
                <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Enterprise Governance Model</div>
                  <div className="mt-2 text-base font-semibold leading-tight">Define standards, operating models, and compliance rules</div>
                </div>
              ) : null}

              <div className={cn('space-y-4', workspaceNavMenuScrollClass(), enterpriseNavUltra ? 'px-0' : undefined)}>
                {PANEL_GROUPS.map(({ group, items }) => (
                  <div key={group} className={cn('space-y-1.5', enterpriseNavUltra ? 'pt-1' : undefined)}>
                    {!enterpriseNavCompact ? (
                      <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div>
                    ) : null}
                    {items.map((panel) => {
                      const Icon = panel.icon
                      const active = isNavActive(pathname, panel.to)
                      return (
                        <NavLink
                          key={panel.to}
                          to={panel.to}
                          className={cn(
                            'group relative flex w-full overflow-hidden border text-left transition-all duration-200',
                            enterpriseNavCompact ? 'items-center gap-2' : 'items-start gap-3',
                            enterpriseNavUltra ? 'rounded-[14px] px-2.5 py-1.5' : 'rounded-[20px] px-3.5 py-3',
                            active
                              ? cn(
                                  'border-slate-300/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] text-slate-950 ring-1 ring-slate-200/70',
                                  enterpriseNavUltra
                                    ? 'shadow-[0_1px_0_0_rgba(15,23,42,0.06),0_10px_22px_-18px_rgba(15,23,42,0.22)]'
                                    : 'shadow-[0_12px_30px_rgba(15,23,42,0.10)]'
                                )
                              : 'border-transparent bg-white/55 text-slate-600 hover:border-slate-200/80 hover:bg-white/88 hover:text-slate-950'
                          )}
                          aria-label={panel.label}
                          title={panel.label}
                        >
                          {active ? (
                            <span
                              className={cn(
                                'absolute left-0 bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-600',
                                enterpriseNavUltra ? 'inset-y-2 w-0.5 rounded-r-full' : 'inset-y-3 w-1 rounded-r-full'
                              )}
                            />
                          ) : null}
                          <span
                            className={cn(
                              'relative shrink-0 items-center justify-center rounded-2xl border transition-colors',
                              enterpriseNavCompact ? 'flex h-9 w-9' : 'flex h-11 w-11',
                              active
                                ? 'border-sky-200 bg-sky-50 text-sky-700'
                                : 'border-slate-200/80 bg-slate-50/90 text-slate-600 group-hover:border-slate-300 group-hover:bg-slate-100'
                            )}
                          >
                            <Icon className={cn(enterpriseNavCompact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]')} strokeWidth={active ? 2.2 : 1.9} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className={cn('block text-sm font-semibold leading-5', active ? 'text-slate-950' : 'text-slate-900')}>
                                {panel.label}
                              </span>
                              {!enterpriseNavCompact ? (
                                <span
                                  className={cn(
                                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                    active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                  )}
                                >
                                  {panel.badge}
                                </span>
                              ) : null}
                            </span>
                            {!enterpriseNavCompact ? (
                              <span className="mt-1 block text-[11px] leading-5 text-slate-500">{panel.description}</span>
                            ) : null}
                          </span>
                        </NavLink>
                      )
                    })}
                  </div>
                ))}
              </div>

              {!enterpriseNavSimpleList ? (
                <div className="space-y-4 pt-4">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/40 dark:bg-blue-950/30">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
                      <BarChart3 className="h-4 w-4" />
                      Registry coverage
                    </div>
                    <div className="mt-3 flex items-start gap-3">
                      <div className="shrink-0 text-3xl font-bold leading-none tabular-nums text-slate-900 dark:text-slate-100">78%</div>
                      <p className="min-w-0 flex-1 text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                        Workspaces bound to an active governance template — signals roll up to Execution Portfolio &amp; Delivery Governance.
                      </p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-blue-100 dark:bg-blue-950/50">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: '78%' }} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <main
            className={cn(
              'flex min-h-0 min-w-0 flex-col self-stretch',
              workspaceMainColumnClass(navDocked, false, enterpriseNavWidthVariant)
            )}
          >
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  )
}
