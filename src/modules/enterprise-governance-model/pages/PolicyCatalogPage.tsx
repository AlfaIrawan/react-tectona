import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fetchGovernanceCatalogSnapshot, type CatalogItemDto } from '@/lib/api/governanceConfigurationApi'

const TITLES: Record<string, { title: string; desc: string }> = {
  workflow: {
    title: 'Workflow Policies',
    desc: 'Delivery lifecycle and checkpoint standards referenced by governance templates.',
  },
  sla: {
    title: 'SLA Policies',
    desc: 'Operational response and delivery SLA standards.',
  },
  naming: {
    title: 'Naming Standards',
    desc: 'Enterprise naming and coding patterns.',
  },
  approval: {
    title: 'Approval Models',
    desc: 'Decision routing and escalation matrices.',
  },
}

function demoPolicies(kind: string): CatalogItemDto[] {
  const base = (code: string, name: string, desc: string): CatalogItemDto => ({
    id: `${kind}-${code}`,
    code,
    name,
    description: desc,
  })
  if (kind === 'workflow')
    return [
      base('WF-01', 'Stage Gate v3', 'Structured enterprise delivery with mandatory checkpoints.'),
      base('WF-02', 'Lean Delivery v2', 'Continuous flow with lightweight governance.'),
    ]
  if (kind === 'sla')
    return [
      base('SLA-01', 'Enterprise P2', 'Priority-2 response and resolution targets.'),
      base('SLA-02', 'Product P3', 'Product squad friendly SLA windows.'),
    ]
  if (kind === 'naming')
    return [
      base('NM-01', 'Portfolio Code STD', 'Canonical portfolio and workspace identifiers.'),
      base('NM-02', 'Product Slug STD', 'URL-safe slugs for product surfaces.'),
    ]
  return [
    base('APR-01', 'Investment Committee Matrix', 'Tiered capital and portfolio approvals.'),
    base('APR-02', 'Squad Delegation', 'Delegated approvals within squad boundaries.'),
  ]
}

export function PolicyCatalogPage() {
  const { policyType } = useParams<{ policyType: string }>()
  const kind = policyType && TITLES[policyType] ? policyType : 'workflow'
  const meta = TITLES[kind]
  const [items, setItems] = useState<CatalogItemDto[]>(() => demoPolicies(kind))

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const snap = await fetchGovernanceCatalogSnapshot()
        if (cancelled) return
        const list =
          kind === 'workflow'
            ? snap.workflowPolicies
            : kind === 'sla'
              ? snap.slaPolicies
              : kind === 'naming'
                ? snap.namingConventions
                : snap.approvalPolicies
        setItems(list.length ? list : demoPolicies(kind))
      } catch {
        if (!cancelled) setItems(demoPolicies(kind))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind])

  const cards = useMemo(() => items, [items])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cards.map((p, idx) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/15 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">
                  v{1 + (idx % 3)}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  Published
                </Badge>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              {[
                ['Owner', idx % 2 ? 'PMO' : 'Enterprise Architecture'],
                ['Usage count', String(12 + idx * 7)],
                ['Last updated', 'May 2026'],
                ['Linked templates', `${4 + idx} bundles`],
                ['Risk / compliance impact', idx % 2 ? 'High' : 'Medium'],
                ['Code', p.code],
              ].map(([k, v]) => (
                <div key={k} className={cn('rounded-lg border border-border/50 bg-background/60 px-2 py-1.5')}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}
