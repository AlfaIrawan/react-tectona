const ROWS = [
  { ts: '2026-05-15 09:12', actor: 'governance.admin', action: 'Template published', object: 'Enterprise Baseline Governance v3', impact: '42 workspaces' },
  { ts: '2026-05-14 16:40', actor: 'pmo.operator', action: 'Policy updated', object: 'Stage Gate v3', impact: 'Version bump' },
  { ts: '2026-05-14 11:05', actor: 'platform.bot', action: 'Rule changed', object: 'RULE-SLA weight 15% → 18%', impact: 'Scoring model' },
  { ts: '2026-05-13 08:22', actor: 'ea.lead', action: 'Template deprecated', object: 'Legacy Baseline v1', impact: '3 workspaces flagged' },
]

export function ChangeHistoryPage() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/60 bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Object</th>
              <th className="px-3 py-2">Impact</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.ts} className="border-t border-border/40">
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.ts}</td>
                <td className="px-3 py-2">{r.actor}</td>
                <td className="px-3 py-2 font-medium">{r.action}</td>
                <td className="px-3 py-2">{r.object}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
