import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { fetchGovernanceCatalogSnapshot, type ComplianceRuleDto } from '@/lib/api/governanceConfigurationApi'

const DEMO: ComplianceRuleDto[] = [
  {
    id: '1',
    code: 'RULE-APPR',
    title: 'Approval Policy Assigned',
    description: 'Ensures active approval matrix before execution states advance.',
    rule_dimension: 'APPROVAL',
    weight: '20%',
    is_active: true,
  },
  {
    id: '2',
    code: 'RULE-SLA',
    title: 'SLA Binding Present',
    description: 'Validates SLA policy attachment for portfolio-tracked work.',
    rule_dimension: 'SLA',
    weight: '15%',
    is_active: true,
  },
]

export function ComplianceRulesEgmPage() {
  const [rules, setRules] = useState<ComplianceRuleDto[]>(DEMO)

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const snap = await fetchGovernanceCatalogSnapshot()
        if (!c && snap.complianceRules.length) setRules(snap.complianceRules)
      } catch {
        /* keep demo */
      }
    })()
    return () => {
      c = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-50/90 via-background to-sky-50/30 p-4 shadow-sm dark:from-slate-950/30 dark:to-sky-950/20"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
              <Badge variant="outline" className="text-[10px] font-semibold">
                {r.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {r.rule_dimension}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Weight {r.weight}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {r.code}
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{r.description}</p>
            <p className="mt-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Calculation logic:</span> weighted rollup across dimensions; evaluated on assignment
              change and nightly batch.
            </p>
            <p className="mt-2 text-[11px] font-medium text-primary">Enforcement scope: workspace portfolio objects</p>
          </div>
        ))}
      </div>
    </div>
  )
}
