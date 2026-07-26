export function UsageAdoptionPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { t: 'Governance template usage by workspace', d: 'Top templates ranked by bound workspaces.' },
          { t: 'Policy adoption by type', d: 'Workflow vs SLA vs naming attachment rates.' },
          { t: 'Unconfigured workspaces', d: '14 workspaces still without a bound template.' },
          { t: 'Deprecated policy usage', d: '3 workspaces referencing deprecated assets.' },
          { t: 'Policy coverage trend', d: 'Rolling 90-day improvement in governed coverage.' },
        ].map((p) => (
          <div key={p.t} className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">{p.t}</h3>
            <p className="mt-2 text-xs text-muted-foreground">{p.d}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
