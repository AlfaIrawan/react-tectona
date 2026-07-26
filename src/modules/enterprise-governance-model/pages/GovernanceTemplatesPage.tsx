import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Eye, Layers, MoreHorizontal, Rocket, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EGM_BASE } from '@/modules/enterprise-governance-model/egmPaths'
import { useToast } from '@/components/ui/toast'
import {
  fetchGovernanceCatalogSnapshot,
  type GovernanceTemplateDto,
} from '@/lib/api/governanceConfigurationApi'

const DEMO_TEMPLATES: {
  name: string
  description: string
  version: string
  status: string
  level: string
  workspaces: number
  workflow: string
  sla: string
  naming: string
  approval: string
  compliance: string
}[] = [
  {
    name: 'Enterprise Baseline Governance',
    description: 'Standard operating model for enterprise delivery, stage gates, and portfolio traceability.',
    version: 'v3',
    status: 'Published',
    level: 'Enterprise Controlled',
    workspaces: 42,
    workflow: 'Stage Gate v3',
    sla: 'Enterprise P2',
    naming: 'Portfolio Code STD',
    approval: 'Investment Committee Matrix',
    compliance: '92%',
  },
  {
    name: 'Agile Product Governance',
    description: 'Lightweight checkpoints with continuous compliance signals for product teams.',
    version: 'v2',
    status: 'Published',
    level: 'Agile Product',
    workspaces: 28,
    workflow: 'Lean Delivery v2',
    sla: 'Product P3',
    naming: 'Product Slug STD',
    approval: 'Squad Delegation',
    compliance: '84%',
  },
  {
    name: 'Innovation Lab Governance',
    description: 'Exploratory delivery with gated experiments and innovation funding rules.',
    version: 'v1',
    status: 'Draft',
    level: 'Innovation Lab',
    workspaces: 9,
    workflow: 'Experiment Gate v1',
    sla: 'Lab P4',
    naming: 'Lab Code STD',
    approval: 'Innovation Board Lite',
    compliance: '71%',
  },
  {
    name: 'Lightweight Team Governance',
    description: 'Minimum viable governance for small teams with delegated approvals.',
    version: 'v1',
    status: 'Published',
    level: 'Lightweight Team',
    workspaces: 15,
    workflow: 'Stream v1',
    sla: 'Team P4',
    naming: 'Short Code STD',
    approval: 'Manager Cascade',
    compliance: '76%',
  },
]

function mapDto(t: GovernanceTemplateDto) {
  return {
    name: t.name,
    description: t.description ?? 'Governance template from catalog.',
    version: `v${t.version}`,
    status: t.status,
    level: 'Catalog',
    workspaces: 0,
    workflow: t.default_workflow_policy_id ? 'Linked' : '—',
    sla: t.default_sla_policy_id ? 'Linked' : '—',
    naming: t.default_naming_convention_id ? 'Linked' : '—',
    approval: t.default_approval_policy_id ? 'Linked' : '—',
    compliance: '—',
  }
}

export function GovernanceTemplatesPage() {
  const { addToast } = useToast()
  const [rows, setRows] = useState<typeof DEMO_TEMPLATES | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const snap = await fetchGovernanceCatalogSnapshot()
        if (cancelled) return
        if (snap.templates.length) setRows(snap.templates.map(mapDto))
        else setRows(DEMO_TEMPLATES)
      } catch {
        if (!cancelled) setRows(DEMO_TEMPLATES)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = rows ?? DEMO_TEMPLATES

  const action = (label: string) =>
    addToast({ title: label, description: 'Demo — wire to governance registry API.', variant: 'default' })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {cards.map((t) => (
          <div
            key={t.name}
            className="flex flex-col rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/15 p-4 shadow-sm lg:flex-row"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.06] text-primary">
                  <Layers className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">{t.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {t.version}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-semibold capitalize">
                      {t.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {t.level}
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  ['Used by workspaces', String(t.workspaces)],
                  ['Workflow policy', t.workflow],
                  ['SLA policy', t.sla],
                  ['Naming standard', t.naming],
                  ['Approval model', t.approval],
                  ['Compliance coverage', t.compliance],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-1.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="text-xs font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-4 flex shrink-0 flex-col justify-between gap-2 border-t border-border/60 pt-4 lg:ml-4 lg:mt-0 lg:w-44 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <div className="flex flex-wrap gap-1 lg:flex-col">
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-semibold" onClick={() => action('Open template')}>
                  <Eye className="h-3.5 w-3.5" /> Open
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-semibold" onClick={() => action('Duplicate')}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-semibold" onClick={() => action('Publish')}>
                  <Rocket className="h-3.5 w-3.5" /> Publish
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-semibold" onClick={() => action('Deprecate')}>
                  <Trash2 className="h-3.5 w-3.5" /> Deprecate
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-semibold" onClick={() => action('View usage')}>
                  <MoreHorizontal className="h-3.5 w-3.5" /> Usage
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
