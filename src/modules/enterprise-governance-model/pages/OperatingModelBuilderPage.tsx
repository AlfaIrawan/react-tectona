import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { EGM_BASE } from '@/modules/enterprise-governance-model/egmPaths'
import { useToast } from '@/components/ui/toast'

const STEPS = [
  'Basic Information',
  'Workflow Standard',
  'SLA Standard',
  'Approval Model',
  'Naming Standard',
  'Compliance Scoring',
  'Review & Publish',
] as const

export function OperatingModelBuilderPage() {
  const { addToast } = useToast()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('enterprise_controlled')
  const [wf, setWf] = useState('stage-gate-v3')
  const [sla, setSla] = useState('enterprise-p2')
  const [approval, setApproval] = useState('investment-committee')
  const [naming, setNaming] = useState('portfolio-std')
  const [compliance, setCompliance] = useState('baseline-rules')

  const publish = () => {
    addToast({
      title: 'Operating model staged (demo)',
      description: `${name || 'Unnamed model'} will publish to the governance registry when API is connected.`,
      variant: 'success',
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/10 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                i === step ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground hover:bg-muted/40'
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <span className="tabular-nums">{i + 1}</span>}
              {s}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4 rounded-xl border border-border/50 bg-background/80 p-4">
          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="om-name">Name</Label>
                <Input id="om-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Delivery Governance" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="om-code">Code</Label>
                <Input id="om-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. GOV-RDG-01" className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="om-level">Governance level</Label>
                <Select id="om-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <SelectItem value="enterprise_controlled">Enterprise Controlled</SelectItem>
                  <SelectItem value="agile_product">Agile Product</SelectItem>
                  <SelectItem value="innovation_lab">Innovation Lab</SelectItem>
                  <SelectItem value="lightweight_team">Lightweight Team</SelectItem>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="om-desc">Description</Label>
                <Textarea id="om-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-2 max-w-md">
              <Label>Workflow policy</Label>
              <Select value={wf} onChange={(e) => setWf(e.target.value)}>
                <SelectItem value="stage-gate-v3">Stage Gate v3</SelectItem>
                <SelectItem value="lean-delivery-v2">Lean Delivery v2</SelectItem>
                <SelectItem value="experiment-gate-v1">Experiment Gate v1</SelectItem>
              </Select>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2 max-w-md">
              <Label>SLA policy</Label>
              <Select value={sla} onChange={(e) => setSla(e.target.value)}>
                <SelectItem value="enterprise-p2">Enterprise P2</SelectItem>
                <SelectItem value="product-p3">Product P3</SelectItem>
                <SelectItem value="lab-p4">Lab P4</SelectItem>
              </Select>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-2 max-w-md">
              <Label>Approval model</Label>
              <Select value={approval} onChange={(e) => setApproval(e.target.value)}>
                <SelectItem value="investment-committee">Investment Committee Matrix</SelectItem>
                <SelectItem value="squad-delegation">Squad Delegation</SelectItem>
                <SelectItem value="manager-cascade">Manager Cascade</SelectItem>
              </Select>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-2 max-w-md">
              <Label>Naming standard</Label>
              <Select value={naming} onChange={(e) => setNaming(e.target.value)}>
                <SelectItem value="portfolio-std">Portfolio Code STD</SelectItem>
                <SelectItem value="product-slug">Product Slug STD</SelectItem>
                <SelectItem value="short-code">Short Code STD</SelectItem>
              </Select>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-2 max-w-md">
              <Label>Compliance rule set</Label>
              <Select value={compliance} onChange={(e) => setCompliance(e.target.value)}>
                <SelectItem value="baseline-rules">Baseline enterprise rules</SelectItem>
                <SelectItem value="product-rules">Product delivery rules</SelectItem>
                <SelectItem value="lab-rules">Innovation lab rules</SelectItem>
              </Select>
              <p className="text-xs text-muted-foreground">
                Compliance scores remain <strong className="text-foreground">read-only</strong> for workspaces — rules are evaluated server-side.
              </p>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-foreground">Review bundle</p>
              <ul className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">
                  <span className="font-medium text-foreground">Name:</span> {name || '—'}
                </li>
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">
                  <span className="font-medium text-foreground">Code:</span> {code || '—'}
                </li>
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5 sm:col-span-2">
                  <span className="font-medium text-foreground">Level:</span> {level.replace(/_/g, ' ')}
                </li>
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">Workflow: {wf}</li>
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">SLA: {sla}</li>
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">Approval: {approval}</li>
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">Naming: {naming}</li>
                <li className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">Compliance: {compliance}</li>
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" className="gap-1" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button type="button" className="gap-1" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" className="gap-1" onClick={publish}>
                Publish model
              </Button>
            )}
            <Link to={`${EGM_BASE}/templates`} className="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
