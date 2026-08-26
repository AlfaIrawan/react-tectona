const AUDIT = [
  { ts: '2026-05-15 09:12', actor: 'governance.admin', action: 'template.published', object: 'tpl_ent_base', impact: 'Audit pack AP-1042' },
  { ts: '2026-05-14 16:40', actor: 'pmo.operator', action: 'policy.updated', object: 'wf_stage_gate_v3', impact: 'Workspace sync queued' },
  { ts: '2026-05-13 18:02', actor: 'workspace.admin', action: 'policy.assigned', object: 'ws_portfolio_office', impact: 'Compliance rescore' },
]

export function AuditTrailPage() {
  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {AUDIT.map((a) => (
          <li key={a.ts + a.action} className="rounded-xl border border-border/60 liquid-glass-enterprise-panel px-3 py-2 text-xs shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{a.ts}</span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{a.action}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {a.actor} · <span className="font-normal text-muted-foreground">{a.object}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{a.impact}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
